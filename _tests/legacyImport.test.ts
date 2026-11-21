/**
 * The legacy Pronix import (D171): the archive reader, the value rules, and one import end to end on a synthetic
 * archive in the old shapes, written, verified and rolled back. The rules a wrong import would break silently are
 * pinned here: a calendar day stays the same day, money and file bytes are copied exactly, per-company list rows
 * become platform rows, sub-companies are recreated, and a rollback leaves the database as it was.
 */
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";

// The sub-company's bot gets a hashed password; a clean checkout has no SALT.
vi.hoisted(() => {
    if (!process.env.SALT) process.env.SALT = "4";
});

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import mongoose from "mongoose";
import {Binary, Decimal128, Long, ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import {BSON, readArchive} from "@propertyManagement/scripts/legacyImport/archiveReader";
import {collectReferences, IdMap} from "@propertyManagement/scripts/legacyImport/idMap";
import {conformToSchema, decryptWithKey, isLocalDay, legacyLocalDay, moneyValues} from "@propertyManagement/scripts/legacyImport/legacyTransforms";
import {runLegacyImport} from "@propertyManagement/scripts/legacyImport/importLegacyArchive";
import {rollback} from "@propertyManagement/scripts/legacyImport/legacyImportWriter";

// ------------------------------------------------------------------------------------------------ archive builder

/** A mongodump `--archive --gzip` file of `collections`, in the format the real tool writes. */
function buildArchive(file: string, database: string, collections: Record<string, Array<Record<string, unknown>>>): void {
    const int32 = (value: number): Buffer => {
        const buffer = Buffer.alloc(4);
        buffer.writeInt32LE(value);
        return buffer;
    };
    const bson = (doc: Record<string, unknown>): Buffer => Buffer.from(BSON.serialize(doc));
    const parts: Buffer[] = [];
    const magic = Buffer.alloc(4);
    magic.writeUInt32LE(0x8199e26d);
    parts.push(magic, bson({concurrent_collections: 1, version: "0.1", server_version: "8.3.11", tool_version: "100.9.5"}));
    for (const name of Object.keys(collections)) parts.push(bson({db: database, collection: name, metadata: "{}", size: 0, type: "collection"}));
    parts.push(int32(-1));
    for (const [name, docs] of Object.entries(collections)) {
        parts.push(bson({db: database, collection: name, EOF: false, CRC: Long.fromNumber(0)}));
        for (const doc of docs) parts.push(bson(doc));
        parts.push(int32(-1));
        parts.push(bson({db: database, collection: name, EOF: true, CRC: Long.fromNumber(0)}), int32(-1));
    }
    fs.writeFileSync(file, zlib.gzipSync(Buffer.concat(parts)));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-import-"));

describe("archive reader", () => {
    it("reads every document of every collection and counts them", async () => {
        const file = path.join(tmp, "small.archive.gz");
        buildArchive(file, "Old", {a: [{_id: new ObjectId(), n: 1}, {_id: new ObjectId(), n: 2}], b: [{_id: new ObjectId(), s: "x"}]});
        const seen: string[] = [];
        const summary = await readArchive(file, (collection, raw) => {
            seen.push(`${collection}:${BSON.deserialize(raw).n ?? BSON.deserialize(raw).s}`);
        });
        expect(seen).toEqual(["a:1", "a:2", "b:x"]);
        expect(Object.fromEntries(summary.counts)).toEqual({a: 2, b: 1});
        expect(summary.collections.map((collection) => collection.collection)).toEqual(["a", "b"]);
    });

    it("refuses a truncated archive", async () => {
        const file = path.join(tmp, "cut.archive");
        buildArchive(file, "Old", {a: [{_id: new ObjectId(), n: 1}]});
        const whole = zlib.gunzipSync(fs.readFileSync(file));
        fs.writeFileSync(file, whole.subarray(0, whole.length - 10));
        await expect(readArchive(file, () => undefined)).rejects.toThrow(/truncated/);
    });
});

describe("value rules", () => {
    it("keeps a midnight-UTC calendar day as that day, and dates a timed value in the company's zone", () => {
        expect(legacyLocalDay(new Date("2026-09-26T00:00:00.000Z"), "America/New_York")).toEqual({day: "2026-09-26", hadTimeOfDay: false});
        expect(legacyLocalDay(new Date("2026-09-26T23:30:00.000Z"), "Europe/Tirane")).toEqual({day: "2026-09-27", hadTimeOfDay: true});
        expect(isLocalDay("2026-02-29")).toBe(false);
        expect(isLocalDay("2028-02-29")).toBe(true);
    });

    it("converts what the current schema stores differently, nested in arrays too, and nothing else", () => {
        const plan = {
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            totalAmount: Decimal128.fromString("100.50"),
            interestRate: 5,
            installments: [{dueDate: new Date("2026-02-01T00:00:00.000Z"), amount: Decimal128.fromString("50.25"), paymentReceipts: [{paidDate: new Date("2026-02-03T21:42:43.771Z"), amount: Decimal128.fromString("50.25")}]}],
        };
        const conversions = conformToSchema(PaymentPlan.schema, plan, "Europe/Tirane");
        expect(plan.startDate).toBe("2026-01-01");
        expect(plan.installments[0].dueDate).toBe("2026-02-01");
        expect(plan.installments[0].paymentReceipts[0].paidDate).toBe("2026-02-03");
        expect(String(plan.totalAmount)).toBe("100.50");
        expect(plan.interestRate).toBe(5);
        expect(conversions.map((conversion) => conversion.path)).toEqual(["startDate", "installments[].dueDate", "installments[].paymentReceipts[].paidDate"]);
    });

    it("remaps ids everywhere, a whole id token in text too, but never inside a longer hex run", () => {
        const oldId = new ObjectId();
        const newId = new ObjectId();
        const map = new IdMap();
        map.set(oldId, newId);
        const cipher = `${"a".repeat(32)}:ff${oldId.toHexString()}ff`;
        const result = map.remap({ref: oldId, list: [oldId], text: `see /media/${oldId.toHexString()}`, exact: oldId.toHexString(), cipher});
        expect(result.ref).toEqual(newId);
        expect(result.list).toEqual([newId]);
        expect(result.text).toBe(`see /media/${newId.toHexString()}`);
        expect(result.exact).toBe(newId.toHexString());
        expect(result.cipher).toBe(cipher);
        expect(collectReferences({_id: new ObjectId(), ref: oldId, items: [{_id: new ObjectId(), owner: oldId}]}).map((reference) => reference.path)).toEqual(["ref", "items[].owner"]);
    });

    it("pairs each amount with its currency, from the same array item when the currency sits there", () => {
        const eur = new ObjectId();
        const chf = new ObjectId();
        const unit = {price: Decimal128.fromString("10.00"), priceCurrency: eur, priceHistory: [{price: Decimal128.fromString("9.00"), currency: chf}]};
        expect(moneyValues(unit, {amount: "priceHistory[].price", currency: "priceHistory[].currency"})).toEqual([{amount: unit.priceHistory[0].price, currency: chf}]);
        expect(moneyValues(unit, {amount: "price", currency: "priceCurrency"})).toEqual([{amount: unit.price, currency: eur}]);
    });

    it("reads a value the old instance encrypted, and refuses the wrong key", () => {
        const payload = encryptWith("hello", "old-key");
        expect(decryptWithKey(payload, "old-key")).toBe("hello");
        expect(() => decryptWithKey(payload, "other-key")).toThrow();
    });
});

function encryptWith(text: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", crypto.createHash("sha256").update(key).digest(), iv);
    return `${iv.toString("hex")}:${Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("hex")}`;
}

// ------------------------------------------------------------------------------------------------ end to end

const db = () => mongoose.connection.db!;
const KEY = "legacy-and-target-key";
const at = (iso: string): Date => new Date(iso);
const created = at("2026-07-10T10:00:00.000Z");

const ids = {
    platform: new ObjectId(), target: new ObjectId(), platformEur: new ObjectId(), platformAl: new ObjectId(), platformState: new ObjectId(), platformCity: new ObjectId(),
    perm: new ObjectId(), targetSalesRole: new ObjectId(), targetAdminRole: new ObjectId(), targetBot: new ObjectId(), existingUser: new ObjectId(),
    oldRoot: new ObjectId(), oldChild: new ObjectId(), oldEur: new ObjectId(), oldUsd: new ObjectId(), oldAl: new ObjectId(), oldState: new ObjectId(), oldCity: new ObjectId(),
    oldPerm: new ObjectId(), oldGonePerm: new ObjectId(), oldSales: new ObjectId(), oldAgent: new ObjectId(), oldChildSales: new ObjectId(),
    staff: new ObjectId(), merged: new ObjectId(), rootBot: new ObjectId(), childBot: new ObjectId(), wallet: new ObjectId(),
    category: new ObjectId(), unitType: new ObjectId(), project: new ObjectId(), edifice: new ObjectId(), floor: new ObjectId(), unit: new ObjectId(), reservation: new ObjectId(),
    media: new ObjectId(), file: new ObjectId(), chunk: new ObjectId(), channel: new ObjectId(), message: new ObjectId(), notification: new ObjectId(),
    audit: new ObjectId(), skippedAudit: new ObjectId(),
};
const fileBytes = crypto.randomBytes(300);
const messageCipher = encryptWith("Hi, is unit A-1 free?", KEY);
const owned = (company: ObjectId) => ({company, createdBy: ids.staff, createdAt: created, updatedAt: created, __v: 0});

async function seedTarget(): Promise<void> {
    await db().collection("companies").insertMany([
        {_id: ids.platform, name: "Platform", vat: "PLAT-1", isPlatformOwner: true, isActive: true, isDefaultForSignUp: false, allowedDomains: [], company: ids.platform, modules: ["core"], deletedAt: null},
        {_id: ids.target, name: "Target Co", vat: "TGT-1", isActive: true, isDefaultForSignUp: false, allowedDomains: [], company: ids.target, modules: ["core", "propertyManagement"], timezone: "Europe/Tirane", deletedAt: null},
    ]);
    await db().collection("currencies").insertOne({_id: ids.platformEur, name: "Euro", symbol: "€", abbreviation: "EUR", decimalPlaces: 2, company: ids.platform, requestStatus: "approved", deletedAt: null});
    await db().collection("countries").insertOne({_id: ids.platformAl, name: "Albania", code: "AL", phoneCode: "+355", company: ids.platform, deletedAt: null});
    await db().collection("states").insertOne({_id: ids.platformState, name: "Tirana County", code: "11", country: ids.platformAl, company: ids.platform, deletedAt: null});
    await db().collection("cities").insertOne({_id: ids.platformCity, name: "Tiranë", state: ids.platformState, country: ids.platformAl, company: ids.platform, deletedAt: null});
    await db().collection("rolepermissions").insertOne({_id: ids.perm, name: "read price", group: "units", tag: "units[read:self:price]", alwaysActive: false, module: "propertyManagement"});
    await db().collection("roles").insertMany([
        {_id: ids.targetSalesRole, name: "Sales Agent", slug: "target co:default:re_sales_agent", permissions: [ids.perm], isAdmin: false, isSignupDefault: false, canEdit: true, canDelete: false, company: ids.target, deletedAt: null},
        {_id: ids.targetAdminRole, name: "SysAdmin", slug: "target co:reserved:sys_admin", permissions: [ids.perm], isAdmin: true, isSignupDefault: false, canEdit: false, canDelete: false, company: ids.target, deletedAt: null},
    ]);
    const membership = (company: ObjectId, roles: ObjectId[]) => ({_id: new ObjectId(), company, roles, rolesCount: roles.length, active: "active", unsuccessfulLogins: 0, lockedOutUntil: null, lastLogin: null});
    await db().collection("users").insertMany([
        {_id: ids.targetBot, username: "TargetCo AI Bot", name: "TargetCo AI", surname: "Bot", fullName: "TargetCo AI Bot", isBot: true, companies: [ids.target], roles: [membership(ids.target, [])], password: "x", timezone: "Europe/Tirane"},
        {_id: ids.existingUser, username: "merged@example.com", name: "Mira", surname: "Existing", fullName: "Mira Existing", companies: [ids.platform], roles: [membership(ids.platform, [])], password: "$2b$10$keepThisHash", timezone: "Europe/Tirane"},
    ]);
}

function oldArchive(file: string): void {
    const membership = (company: ObjectId, roles: ObjectId[]) => ({_id: new ObjectId(), company, roles, rolesCount: roles.length, active: "active", unsuccessfulLogins: 0, lockedOutUntil: null, lastLogin: null});
    const user = (_id: ObjectId, username: string, extra: Record<string, unknown>) => ({
        _id, username, name: username.split("@")[0], surname: "Old", fullName: `${username.split("@")[0]} Old`, timezone: "Europe/Berlin", password: "$2b$10$oldHash",
        mfaStatus: "notActive", online: false, isBot: false, registerDate: created, createdAt: created, updatedAt: created, __v: 0, ...extra,
    });
    buildArchive(file, "Pronix", {
        companies: [
            {_id: ids.oldRoot, name: "Pronix", vat: "Z123", description: "Old root", website: "https://pronix.example", parentCompany: null, isActive: true, isDefaultForSignUp: true, allowedDomains: [], addresses: [], company: ids.oldRoot, createdAt: created, updatedAt: created},
            {_id: ids.oldChild, name: "Artech Test", vat: "L7-TEST", description: "Old child", parentCompany: ids.oldRoot, isActive: true, isDefaultForSignUp: false, allowedDomains: [], addresses: [], company: ids.oldRoot, createdBy: ids.staff, createdAt: created, updatedAt: created},
        ],
        currencies: [
            {_id: ids.oldEur, abbreviation: "EUR", symbol: "€", name: "Euro", decimalPlaces: 2, ...owned(ids.oldRoot)},
            {_id: ids.oldUsd, abbreviation: "USD", symbol: "$", name: "US Dollar", decimalPlaces: 2, ...owned(ids.oldRoot)},
        ],
        countries: [{_id: ids.oldAl, name: "Albania", code: "AL", phoneCode: "+355", ...owned(ids.oldRoot)}],
        states: [{_id: ids.oldState, name: "Tirana County", code: "11", country: ids.oldAl, ...owned(ids.oldRoot)}],
        cities: [{_id: ids.oldCity, name: "Tirane", state: ids.oldState, country: ids.oldAl, ...owned(ids.oldRoot)}],
        rolepermissions: [
            {_id: ids.oldPerm, name: "read price", group: "units", tag: "units[read:self:price]"},
            {_id: ids.oldGonePerm, name: "gone", group: "gone", tag: "gone[read:self:x]"},
        ],
        roles: [
            {_id: ids.oldSales, name: "Sales Agent", slug: "pronix:default:re_sales_agent", permissions: [ids.oldPerm, ids.oldGonePerm], isAdmin: false, isSignupDefault: false, canEdit: true, canDelete: false, description: "", ...owned(ids.oldRoot)},
            {_id: ids.oldAgent, name: "Agent", slug: "pronix:default:agent", permissions: [ids.oldPerm, ids.oldGonePerm], isAdmin: false, isSignupDefault: false, canEdit: true, canDelete: true, description: "", ...owned(ids.oldRoot)},
            {_id: ids.oldChildSales, name: "Sales Agent", slug: "artech test:default:re_sales_agent", permissions: [ids.oldPerm], isAdmin: false, isSignupDefault: false, canEdit: true, canDelete: false, description: "", ...owned(ids.oldChild)},
        ],
        users: [
            user(ids.staff, "staff@example.com", {companies: [ids.oldRoot, ids.oldChild], roles: [membership(ids.oldRoot, [ids.oldSales, ids.oldAgent]), membership(ids.oldChild, [ids.oldChildSales])], finance: [ids.wallet], birthday: at("1990-05-04T00:00:00.000Z")}),
            user(ids.merged, "merged@example.com", {companies: [ids.oldRoot], roles: [membership(ids.oldRoot, [ids.oldSales])]}),
            user(ids.rootBot, "Pronix AI Bot", {isBot: true, companies: [ids.oldRoot], roles: [membership(ids.oldRoot, [])]}),
            user(ids.childBot, "ArtechTest AI Bot", {isBot: true, companies: [ids.oldChild], roles: [membership(ids.oldChild, [])]}),
        ],
        finances: [{_id: ids.wallet, company: ids.oldRoot, currencies: [{_id: new ObjectId(), amount: Decimal128.fromString("0"), currency: ids.oldEur}]}],
        "media.files": [{_id: ids.file, length: fileBytes.length, chunkSize: 261120, uploadDate: created, filename: "plan.png", metadata: {unit: ids.unit.toHexString()}}],
        "media.chunks": [{_id: ids.chunk, files_id: ids.file, n: 0, data: new Binary(fileBytes)}],
        media: [{_id: ids.media, type: "image", originalName: "plan.png", fileName: "plan.png", fileId: ids.file, metadata: {_id: new ObjectId(), size: fileBytes.length, extension: "png", mime: "image/png", safeCheckedFlag: true}, mimeType: "image/png", extension: "png", fileSize: fileBytes.length, sizeInBytes: fileBytes.length, uploadedAt: created, ...owned(ids.oldRoot)}],
        unittypecategories: [{_id: ids.category, name: "Apartments", ...owned(ids.oldRoot)}],
        unittypes: [{_id: ids.unitType, name: "Apartment", slug: "pronix_apartment", category: ids.category, description: "", icon: "home", isPrivate: false, ...owned(ids.oldRoot)}],
        projects: [{_id: ids.project, name: "Old Tower", description: "", mainImage: ids.media, imageGallery: [], videoGallery: [], mediaFiles: [], ...owned(ids.oldRoot)}],
        edifices: [{
            _id: ids.edifice, name: "Block A", project: ids.project, mainImage: ids.media, imageGallery: [], videoGallery: [], mediaFiles: [],
            address: {_id: new ObjectId(), street: "Rruga 1", postalCode: "1001", country: ids.oldAl, state: ids.oldState, city: ids.oldCity, latitude: 41.3, longitude: 19.8},
            investmentValue: Decimal128.fromString("5000000.00"), investmentCurrency: ids.oldEur, saleCurrency: ids.oldEur, pricePerMeterSquared: 1500.5,
            constructionStartDate: at("2026-01-01T00:00:00.000Z"), commercialFacilities: [], neighborhoodFacilities: [], constructors: [], propertyTypes: [], polygonCoordinates: [], ...owned(ids.oldRoot),
        }],
        floors: [{_id: ids.floor, name: "Floor 1", levelNumber: 1, totalUnits: 1, area: 100, isAccessible: true, hasEmergencyExit: false, sharedSpaces: [], edifice: ids.edifice, project: ids.project, mainImage: ids.media, imageGallery: [], videoGallery: [], mediaFiles: [], ...owned(ids.oldRoot)}],
        units: [{
            _id: ids.unit, unitType: ids.unitType, unitNumber: "A-1", name: "A-1", area: 80, sharedArea: 10, netArea: 70, verandaArea: 5,
            price: Decimal128.fromString("123456.78"), priceCurrency: ids.oldEur, hasBalcony: true, hasTerrace: false, hasSeaView: false, hasCityView: true, hasLakeView: false, hasElevator: true,
            numberOfRooms: 3, numberOfBathrooms: 1, description: "", mainImage: ids.media, imageGallery: [], videoGallery: [], mediaFiles: [], polygonCoordinates: [],
            status: "reserved_unit", reservation: ids.reservation, connectedUnits: [], inspections: [], modificationRequests: [], costs: [], floor: ids.floor, edifice: ids.edifice, project: ids.project,
            priceHistory: [{_id: new ObjectId(), price: Decimal128.fromString("120000.00"), currency: ids.oldEur, changedAt: created, changedBy: ids.staff, reason: "launch"}],
            priceManuallyEdited: false, featuredOnHomepage: false, featuredSortOrder: 0, ...owned(ids.oldRoot),
        }],
        reservations: [{
            _id: ids.reservation, name: "RES-1", unit: ids.unit, reservedBy: ids.staff, reservedByCompany: ids.oldRoot, client: ids.merged,
            reservationDate: at("2026-09-26T23:30:00.000Z"), expirationDate: at("2026-12-31T00:00:00.000Z"),
            depositAmount: Decimal128.fromString("1000.00"), depositCurrency: ids.oldUsd, paid: false, isActive: true, status: "active", source: "walk_in",
            reservationContract: [], additionalDocuments: [], ...owned(ids.oldRoot),
        }],
        channels: [{_id: ids.channel, name: "AI", users: [ids.staff, ids.rootBot], owner: ids.staff, isGroup: false, isAiAssistant: true, aiOwnerUser: ids.staff, isPublicChat: false, publicChat: null, pinnedMessages: [], adminUsers: [], leftUsers: [], lastAction: created, ...owned(ids.oldRoot)}],
        messages: [{_id: ids.message, channel: ids.channel, sender: ids.staff, text: messageCipher, mediaIds: [], status: "active", type: "message", mentionedUsers: [], reactions: [], delivery: [], deletedFor: [], ...owned(ids.oldRoot)}],
        notifications: [{_id: ids.notification, sender: ids.staff, receiver: ids.merged, code: "RESERVATION_CREATED", description: "", content: {unitId: ids.unit.toHexString(), reservationId: ids.reservation.toHexString()}, extraMessages: [], importance: "medium", status: "info", category: "financial", channels: ["in_app"], metadata: null, date: created, ...owned(ids.oldRoot)}],
        auditlogs: [
            {_id: ids.audit, documentId: ids.unit, collectionName: "units", action: "CREATE", diff: {price: {from: null, to: "123456.78"}}, actorId: ids.staff, company: ids.oldRoot, createdAt: created, updatedAt: created},
            {_id: ids.skippedAudit, documentId: ids.oldPerm, collectionName: "rolepermissions", action: "CREATE", diff: {}, company: new ObjectId("000000000000000000000000"), createdAt: created, updatedAt: created},
        ],
        apiaccesses: [{_id: new ObjectId(), endpoint: "/x", company: ids.oldRoot}, {_id: new ObjectId(), endpoint: "/y", company: ids.oldRoot}],
    });
}

async function snapshot(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const {name} of await db().listCollections({}, {nameOnly: true}).toArray()) counts[name] = await db().collection(name).countDocuments({});
    return counts;
}

describe("legacy import end to end", () => {
    const archive = path.join(tmp, "pronix.archive.gz");
    const run = (execute: boolean, reportDir: string) => asCrossTenant("legacy import test", () => runLegacyImport({
        archivePath: archive, targetCompany: "Target Co", execute, reportDir, legacyEncryptionKey: KEY, targetEncryptionKey: KEY, log: () => undefined,
    }));
    let before: Record<string, number>;

    beforeAll(async () => {
        await connectTestDatabase();
        await seedTarget();
        oldArchive(archive);
        before = await snapshot();
    }, 120_000);

    afterAll(async () => {
        await disconnectTestDatabase();
    });

    it("plans without writing, accounting for every document", async () => {
        const dry = await run(false, path.join(tmp, "dry"));
        expect(dry.plan.errors).toEqual([]);
        expect(dry.ok).toBe(true);
        expect(await snapshot()).toEqual(before);
        const ledger = Object.fromEntries(dry.plan.ledger.table(dry.plan.source.summary.counts).map((row) => [row.collection, row]));
        expect(ledger.apiaccesses).toMatchObject({source: 2, skipped: 2});
        expect(ledger.finances).toMatchObject({source: 1, skipped: 1});
        expect(ledger.auditlogs).toMatchObject({source: 2, inserted: 1, skipped: 1});
        expect(ledger.users).toMatchObject({source: 4, inserted: 1, merged: 3});
        expect(ledger.currencies).toMatchObject({source: 2, inserted: 1, merged: 1});
    }, 120_000);

    it("writes the archive under the target, converted to the current shapes, and proves it", async () => {
        const result = await run(true, path.join(tmp, "execute"));
        expect(result.failures).toEqual([]);
        expect(result.ok).toBe(true);

        const usd = await db().collection("currencies").findOne({abbreviation: "USD"});
        expect(usd).toMatchObject({company: ids.platform, requestStatus: "approved", decimalPlaces: 2});

        const unit = await db().collection("units").findOne({_id: ids.unit});
        expect(unit).toMatchObject({company: ids.target, priceCurrency: ids.platformEur, unitNumber: "A-1"});
        expect(String(unit?.price)).toBe("123456.78");
        expect(unit?.priceHistory[0].currency).toEqual(ids.platformEur);
        expect(unit?.createdAt).toEqual(created);

        const reservation = await db().collection("reservations").findOne({_id: ids.reservation});
        expect(reservation).toMatchObject({reservationDate: "2026-09-27", expirationDate: "2026-12-31", depositCurrency: usd?._id, client: ids.existingUser, reservedByCompany: ids.target});

        const edifice = await db().collection("edifices").findOne({_id: ids.edifice});
        expect(edifice?.address).toMatchObject({country: ids.platformAl, state: ids.platformState, city: ids.platformCity});
        expect(edifice?.constructionStartDate).toBe("2026-01-01");

        const sub = await db().collection("companies").findOne({_id: ids.oldChild});
        expect(sub).toMatchObject({name: "Artech Test", parentCompany: ids.target, company: ids.target, createdBy: ids.staff, createdAt: created});
        const subSales = await db().collection("roles").findOne({company: ids.oldChild, slug: {$regex: ":default:re_sales_agent$"}});
        expect(subSales).toBeTruthy();
        const subBot = await db().collection("users").findOne({isBot: true, companies: ids.oldChild});
        expect(subBot).toBeTruthy();

        const staff = await db().collection("users").findOne({_id: ids.staff});
        expect(staff).not.toHaveProperty("finance");
        expect(staff?.password).toBe("$2b$10$oldHash");
        const agentRole = await db().collection("roles").findOne({company: ids.target, slug: "target_co:agent"});
        expect(agentRole?.permissions).toEqual([ids.perm]);
        const membershipOf = (user: typeof staff, company: ObjectId) => user?.roles.find((entry: {company: ObjectId}) => String(entry.company) === String(company));
        expect(membershipOf(staff, ids.target).roles).toEqual([ids.targetSalesRole, agentRole?._id]);
        expect(membershipOf(staff, ids.oldChild).roles).toEqual([subSales?._id]);
        expect(staff?.companies).toEqual([ids.target, ids.oldChild]);

        const existing = await db().collection("users").findOne({_id: ids.existingUser});
        expect(existing?.password).toBe("$2b$10$keepThisHash");
        expect(membershipOf(existing, ids.target).roles).toEqual([ids.targetSalesRole]);
        expect(existing?.companies).toEqual([ids.platform, ids.target]);

        const chunk = await db().collection("media.chunks").findOne({_id: ids.chunk});
        expect(Buffer.from(chunk?.data.buffer).equals(fileBytes)).toBe(true);
        expect(await db().collection("media").findOne({_id: ids.media})).toMatchObject({company: ids.target, isPublic: true});

        expect(await db().collection("channels").findOne({_id: ids.channel})).toMatchObject({users: [ids.staff, ids.targetBot], company: ids.target});
        expect((await db().collection("messages").findOne({_id: ids.message}))?.text).toBe(messageCipher);
        expect(await db().collection("auditlogs").countDocuments({_id: {$in: [ids.audit, ids.skippedAudit]}})).toBe(1);
        expect(await db().collection("apiaccesses").countDocuments({})).toBe(0);
        expect((await db().collection("companies").findOne({_id: ids.target}))?.website).toBe("https://pronix.example");
    }, 180_000);

    it("refuses to import the same archive twice", async () => {
        const again = await run(false, path.join(tmp, "again"));
        expect(again.ok).toBe(false);
        expect(again.plan.errors.join("\n")).toMatch(/already in the target|imported before/);
    }, 120_000);

    it("rolls back to exactly the database it found, and can import again", async () => {
        await asCrossTenant("legacy import test", () => rollback(path.join(tmp, "execute", "journal.ndjson"), () => undefined));
        const after = await snapshot();
        // Collections the import created stay, empty.
        for (const [name, count] of Object.entries(after)) expect([name, count]).toEqual([name, before[name] ?? 0]);
        expect(await db().collection("users").findOne({_id: ids.existingUser})).toMatchObject({companies: [ids.platform]});
        expect((await db().collection("companies").findOne({_id: ids.target}))?.website).toBeUndefined();

        const second = await run(true, path.join(tmp, "execute-2"));
        expect(second.failures).toEqual([]);
        expect(second.ok).toBe(true);
    }, 180_000);
});
