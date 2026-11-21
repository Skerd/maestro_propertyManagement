/**
 * Builds the legacy import plan (D171): reads the archive and the target database, decides every mapping, turns each
 * old document into the document the current schema stores, and validates all of it. Nothing is written here; a dry
 * run is this plan plus its report, and `--execute` writes exactly this plan.
 */
import mongoose, {Model} from "mongoose";
import {Decimal128, ObjectId} from "mongodb";
import {EncryptString} from "@coreModule/utilities/security/encryption";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {effectiveCompanyModules} from "@coreModule/utilities/modules/companyModules";
import {DEFAULT_ROLE_SLUG_PATTERN} from "@coreModule/database/schemas/role/role.defaults";
import {getPublicMediaBackfillSources} from "@coreModule/utilities/media/publicMediaBackfillRegistry";
import {collectPublicMediaIds} from "armonia/src/modules/core/helpers/collectPublicMediaIds";
import type {SchemaDef} from "armonia/src/modules/core/helpers/schemaDefBuilder";
import {fromMinor, sumMinor, toMinor} from "armonia/src/modules/core/helpers/money";
import Company from "@coreModule/database/schemas/company/company";
import User from "@coreModule/database/schemas/user/user";
import Role from "@coreModule/database/schemas/role/role";
import Currency from "@coreModule/database/schemas/currency/currency";
import Country from "@coreModule/database/schemas/country/country";
import State from "@coreModule/database/schemas/state/state";
import City from "@coreModule/database/schemas/city/city";
import Media from "@coreModule/database/schemas/media/media";
import Channel from "@coreModule/database/schemas/channel/channel";
import Message from "@coreModule/database/schemas/message/message";
import LastChannelReadMessage from "@coreModule/database/schemas/lastChannelReadMessage/lastChannelReadMessage";
import Notification from "@coreModule/database/schemas/notification/notification";
import SmtpServer from "@coreModule/database/schemas/smtpServer/smtpServer";
import AuditLog from "@coreModule/database/schemas/auditLog/auditLog";
import LoginHistory from "@coreModule/database/schemas/loginHistory/loginHistory";
// Registers the propertyManagement models and their public-media rules.
import "@propertyManagement/database/moduleBootstrap";
import Project from "@propertyManagement/database/schemas/project/project";
import Edifice from "@propertyManagement/database/schemas/edifice/edifice";
import Floor from "@propertyManagement/database/schemas/floor/floor";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import Lead from "@propertyManagement/database/schemas/lead/lead";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import HandoverPackage from "@propertyManagement/database/schemas/handoverPackage/handoverPackage";
import ConstructionProgress from "@propertyManagement/database/schemas/constructionProgress/constructionProgress";
import Story from "@propertyManagement/database/schemas/story/story";
import StoryType from "@propertyManagement/database/schemas/storyType/storyType";
import UnitType from "@propertyManagement/database/schemas/unitType/unitType";
import UnitTypeCategory from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory";
import InspectionChecklistTemplate from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import PropertyManagementConfig from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig";
import {ArchiveSummary, BSON, rawObjectIdHex, readArchive} from "./archiveReader";
import {collectReferences, IdMap, isPlainObject} from "./idMap";
import {
    AUDIT_SKIPPED_COLLECTIONS, conformToSchema, Conversion, decryptWithKey, ENCRYPTED_FIELDS, isEncryptedPayload, isLocalDay,
    MONEY_FIELDS, moneyValues, RETIRED_COLLECTIONS, skippedReason,
} from "./legacyTransforms";

export type Doc = Record<string, unknown> & {_id: ObjectId};

const GRIDFS_FILES = "media.files";
const GRIDFS_CHUNKS = "media.chunks";
/** Decimal places the money checksums are taken at: the most a currency may have (core Currency schema). */
const CHECKSUM_DECIMALS = 8;
const UNUSABLE_REQUEST_STATUSES = ["requested", "rejected", "withdrawn"];

/**
 * The imported collections in write order, each with the current model it is validated against. A source
 * collection in neither this list, the special cases nor the skip lists stops the import: nothing is dropped silently.
 */
const IMPORTED_COLLECTIONS: ReadonlyArray<[string, Model<any>]> = [
    ["media", Media],
    ["unittypecategories", UnitTypeCategory],
    ["unittypes", UnitType],
    ["storytypes", StoryType],
    ["projects", Project],
    ["edifices", Edifice],
    ["floors", Floor],
    ["units", Unit],
    ["handoverpackages", HandoverPackage],
    ["inspectionchecklisttemplates", InspectionChecklistTemplate],
    ["leads", Lead],
    ["reservations", Reservation],
    ["sales", Sale],
    ["paymentplans", PaymentPlan],
    ["commissions", Commission],
    ["unitcosts", UnitCost],
    ["modificationrequests", ModificationRequest],
    ["constructionprogresses", ConstructionProgress],
    ["stories", Story],
    ["propertymanagementconfigs", PropertyManagementConfig],
    ["channels", Channel],
    ["messages", Message],
    ["lastchannelreadmessages", LastChannelReadMessage],
    ["notifications", Notification],
    ["loginhistories", LoginHistory],
    ["auditlogs", AuditLog],
    ["smtpservers", SmtpServer],
];

/** Collections handled by their own step (mapped, merged or created) rather than copied. */
const SPECIAL_COLLECTIONS = new Set(["companies", "users", "roles", "rolepermissions", "currencies", "countries", "states", "cities", GRIDFS_FILES, GRIDFS_CHUNKS]);

/** Paths that hold history, not references: remapped, but not checked as references. */
const HISTORY_PATHS: Readonly<Record<string, readonly string[]>> = {auditlogs: ["diff"]};

/** Company profile fields copied into the target only where the target has none (user decision 3). */
const PROFILE_FIELDS = ["email", "phoneNumber", "description", "website", "linkedin", "instagram", "facebook", "allowedDomains", "addresses", "logo"] as const;

export interface ImportOptions {
    archivePath: string;
    /** The target company: its id, VAT or exact name. */
    targetCompany: string;
    /** The zone a timed old value's calendar day is taken in; defaults to the target company's zone. */
    timeZone?: string;
    /** The old instance's ENCRYPTION_KEY; defaults to this instance's. */
    legacyEncryptionKey?: string;
    /** This instance's ENCRYPTION_KEY. */
    targetEncryptionKey?: string;
}

// ------------------------------------------------------------------------------------------------ source

export interface SourceData {
    database: string;
    summary: ArchiveSummary;
    /** Every decoded document per collection (telemetry and GridFS chunks are not decoded). */
    docs: Map<string, Doc[]>;
    /** The source collection of every `_id` in the archive (GridFS chunks excluded). */
    collectionOf: Map<string, string>;
    /** SHA-256 of every GridFS chunk, per file id and chunk number. */
    chunkDigests: Map<string, Map<number, string>>;
    chunkCount: number;
}

/** First pass over the archive: decodes what is imported, indexes the ids of what is not, and fingerprints every file chunk. */
export async function loadSource(archivePath: string): Promise<SourceData> {
    const crypto = await import("node:crypto");
    const docs = new Map<string, Doc[]>();
    const collectionOf = new Map<string, string>();
    const chunkDigests = new Map<string, Map<number, string>>();
    let chunkCount = 0;
    const summary = await readArchive(archivePath, (collection, raw) => {
        if (collection === GRIDFS_CHUNKS) {
            const chunk = BSON.deserialize(raw, {promoteBuffers: true});
            const fileId = String(chunk.files_id);
            const digests = chunkDigests.get(fileId) ?? new Map<number, string>();
            digests.set(Number(chunk.n), crypto.createHash("sha256").update(chunk.data as Buffer).digest("hex"));
            chunkDigests.set(fileId, digests);
            chunkCount += 1;
            return;
        }
        if (skippedReason(collection)) {
            const hex = rawObjectIdHex(raw);
            if (hex) collectionOf.set(hex, collection);
            return;
        }
        const doc = BSON.deserialize(raw) as Doc;
        collectionOf.set(String(doc._id), collection);
        const list = docs.get(collection) ?? [];
        list.push(doc);
        docs.set(collection, list);
    });
    const databases = new Set(summary.collections.map((collection) => collection.db));
    if (databases.size !== 1) throw new Error(`The archive holds ${databases.size} databases; one is expected`);
    return {database: [...databases][0], summary, docs, collectionOf, chunkDigests, chunkCount};
}

// ------------------------------------------------------------------------------------------------ plan types

type Outcome = "inserted" | "merged" | "skipped";

/** Exactly one outcome per source document; the per-collection totals must equal the archive's counts. */
export class Ledger {
    private readonly rows = new Map<string, Map<string, {outcome: Outcome; detail?: string}>>();
    private readonly bulk = new Map<string, {outcome: Outcome; count: number; reason: string}>();

    record(collection: string, id: unknown, outcome: Outcome, detail?: string): void {
        const rows = this.rows.get(collection) ?? new Map<string, {outcome: Outcome; detail?: string}>();
        const key = String(id);
        if (rows.has(key)) throw new Error(`ledger: ${collection} ${key} was given two outcomes`);
        rows.set(key, {outcome, detail});
        this.rows.set(collection, rows);
    }

    recordAll(collection: string, count: number, outcome: Outcome, reason: string): void {
        this.bulk.set(collection, {outcome, count, reason});
    }

    /** The outcome already decided for a document, if any (a merge is decided before the documents are prepared). */
    outcomeOf(collection: string, id: unknown): Outcome | undefined {
        return this.rows.get(collection)?.get(String(id))?.outcome;
    }

    /** The ids given `outcome` in `collection`. */
    idsWith(collection: string, outcome: Outcome): string[] {
        return [...(this.rows.get(collection) ?? new Map<string, {outcome: Outcome}>())].filter(([, row]) => row.outcome === outcome).map(([id]) => id);
    }

    /** One row per source collection: archive count and the documents per outcome. */
    table(counts: Map<string, number>): Array<{collection: string; source: number; inserted: number; merged: number; skipped: number; note: string}> {
        const names = new Set([...counts.keys(), ...this.rows.keys(), ...this.bulk.keys()]);
        return [...names].sort().map((collection) => {
            const totals = {inserted: 0, merged: 0, skipped: 0};
            const reasons = new Set<string>();
            for (const row of this.rows.get(collection)?.values() ?? []) {
                totals[row.outcome] += 1;
                if (row.outcome === "skipped" && row.detail) reasons.add(row.detail);
            }
            const bulk = this.bulk.get(collection);
            if (bulk) {
                totals[bulk.outcome] += bulk.count;
                reasons.add(bulk.reason);
            }
            return {collection, source: counts.get(collection) ?? 0, ...totals, note: [...reasons].join("; ")};
        });
    }

    /** The collections whose outcomes do not add up to the archive count. */
    imbalances(counts: Map<string, number>): string[] {
        return this.table(counts)
            .filter((row) => row.inserted + row.merged + row.skipped !== row.source)
            .map((row) => `${row.collection}: archive ${row.source}, accounted ${row.inserted + row.merged + row.skipped}`);
    }
}

export interface InsertBatch {
    source: string;
    collection: string;
    model?: Model<any>;
    docs: Doc[];
}

/** A raw `$set` on an existing row, written with its before-image in the journal. */
export interface UpdateOp {
    collection: string;
    id: ObjectId;
    set: Record<string, unknown>;
    reason: string;
}

/** A sub-company recreated under the target (user decision 2), through `Company.save()` so it is provisioned like any new company. */
export interface SubCompany {
    oldId: ObjectId;
    doc: Doc;
    restore: {createdBy?: ObjectId; createdAt?: Date; updatedAt?: Date};
}

/** An id that exists only once a sub-company is created (its default roles, its bot). */
export interface Placeholder {
    id: ObjectId;
    company: ObjectId;
    kind: "role" | "bot";
    /** For a role: its slug suffix, e.g. `:default:re_sales_agent`. */
    suffix?: string;
}

export interface ImportPlan {
    options: ImportOptions;
    source: SourceData;
    target: {company: Doc; platformId: ObjectId; timeZone: string; modules: string[]; sameEncryptionKey: boolean};
    idMap: IdMap;
    ledger: Ledger;
    errors: string[];
    notes: Map<string, string[]>;
    platformRows: InsertBatch[];
    profileUpdate?: UpdateOp;
    subCompanies: SubCompany[];
    placeholders: Placeholder[];
    roles: InsertBatch;
    users: InsertBatch;
    userUpdates: UpdateOp[];
    gridFsFiles: InsertBatch;
    batches: InsertBatch[];
    lateUpdates: UpdateOp[];
    idRemaps: Array<{collection: string; from: string; to: string; reason: string}>;
    conversions: Array<Conversion & {collection: string; id: string}>;
    moneyTotals: {source: Record<string, string>; imported: Record<string, string>};
    /** Every id the imported documents may point at once the plan is written. */
    knownIds: Set<string>;
}

// ------------------------------------------------------------------------------------------------ helpers

const db = () => {
    const database = mongoose.connection.db;
    if (!database) throw new Error("Not connected to MongoDB");
    return database;
};

const raw = (collection: string) => db().collection(collection);

const ejson = (value: unknown): string => BSON.EJSON.stringify(value, {relaxed: false});

function isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function note(plan: Pick<ImportPlan, "notes">, section: string, line: string): void {
    const lines = plan.notes.get(section) ?? [];
    lines.push(line);
    plan.notes.set(section, lines);
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lower-case, accents removed: "Durrës" and "durres" are the same place name. */
function placeKey(name: unknown): string {
    return String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function readDotted(document: Record<string, unknown>, path: string): unknown {
    let current: unknown = document;
    for (const step of path.split(".")) {
        if (!isPlainObject(current)) return undefined;
        current = current[step];
    }
    return current;
}

/** `$type` for the BSON types partial indexes here use; an unknown type name counts as a match. */
function hasBsonType(value: unknown, type: unknown): boolean {
    switch (type) {
        case "objectId": return value instanceof ObjectId;
        case "string": return typeof value === "string";
        case "date": return value instanceof Date;
        case "bool": return typeof value === "boolean";
        case "null": return value === null;
        case "number": case "double": case "int": case "long": return typeof value === "number";
        case "decimal": return value instanceof Decimal128;
        default: return true;
    }
}

/** Whether `document` satisfies a partial-index filter. Unknown operators count as a match, so the check errs towards checking. */
function matchesFilter(document: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(([path, condition]) => {
        const value = readDotted(document, path);
        if (isPlainObject(condition)) {
            return Object.entries(condition).every(([operator, operand]) => {
                if (operator === "$exists") return (value !== undefined) === Boolean(operand);
                if (operator === "$eq") return ejson(value ?? null) === ejson(operand ?? null);
                if (operator === "$type") return hasBsonType(value, operand);
                return true;
            });
        }
        if (condition === null) return value === null || value === undefined;
        return ejson(value ?? null) === ejson(condition);
    });
}

/** Runs `fn` on the value at `path` (with `[]` fan-out), replacing it with the result. */
function mapPath(document: Record<string, unknown>, path: string, fn: (value: unknown) => unknown): void {
    const [step, ...rest] = path.split(".");
    const isArray = step.endsWith("[]");
    const key = isArray ? step.slice(0, -2) : step;
    if (!(key in document)) return;
    if (isArray) {
        const items = document[key];
        if (!Array.isArray(items)) return;
        for (const item of items) if (isPlainObject(item) && rest.length > 0) mapPath(item, rest.join("."), fn);
        return;
    }
    if (rest.length === 0) {
        document[key] = fn(document[key]);
    } else if (isPlainObject(document[key])) {
        mapPath(document[key] as Record<string, unknown>, rest.join("."), fn);
    }
}

// ------------------------------------------------------------------------------------------------ build

/** Reads the target, decides every mapping and prepares every document. Writes nothing. */
export async function buildPlan(options: ImportOptions, source: SourceData): Promise<ImportPlan> {
    const plan: ImportPlan = {
        options,
        source,
        target: {company: {_id: new ObjectId()}, platformId: new ObjectId(), timeZone: "UTC", modules: [], sameEncryptionKey: true},
        idMap: new IdMap(),
        ledger: new Ledger(),
        errors: [],
        notes: new Map(),
        platformRows: [],
        subCompanies: [],
        placeholders: [],
        roles: {source: "roles", collection: Role.collection.collectionName, model: Role, docs: []},
        users: {source: "users", collection: User.collection.collectionName, model: User, docs: []},
        userUpdates: [],
        gridFsFiles: {source: GRIDFS_FILES, collection: GRIDFS_FILES, docs: []},
        batches: [],
        lateUpdates: [],
        idRemaps: [],
        conversions: [],
        moneyTotals: {source: {}, imported: {}},
        knownIds: new Set(),
    };
    const docs = (collection: string): Doc[] => source.docs.get(collection) ?? [];

    accountForSkippedCollections(plan);
    if (!(await resolveTarget(plan))) return plan;
    checkEncryption(plan);

    const companies = await mapCompanies(plan, docs("companies"));
    await mapCurrencies(plan, docs("currencies"));
    await mapPlaces(plan);
    const permissionByTag = await loadPermissionCatalog(plan);
    const tagById = mapPermissions(plan, docs("rolepermissions"), permissionByTag);
    await mapRoles(plan, docs("roles"), companies, tagById, permissionByTag);
    await mapUsers(plan, docs("users"));
    await mapLookups(plan);
    await mapAiChannels(plan, docs("channels"));
    await resolveIdCollisions(plan, companies.ownCompanyIds);
    finalizeCompanies(plan);
    retireCollections(plan);

    prepareUsers(plan, docs("users"));
    prepareGridFsFiles(plan, docs(GRIDFS_FILES));
    await prepareBatches(plan);
    applyPublicMedia(plan);
    computeMoneyTotals(plan);
    forecastCronEffects(plan);

    collectKnownIds(plan);
    checkReferences(plan);
    await checkUniqueIndexes(plan);
    checkUnhandledCollections(plan);
    for (const imbalance of plan.ledger.imbalances(source.summary.counts)) plan.errors.push(`Ledger does not balance: ${imbalance}`);
    return plan;
}

function accountForSkippedCollections(plan: ImportPlan): void {
    for (const [collection, count] of plan.source.summary.counts) {
        const reason = skippedReason(collection);
        if (reason) plan.ledger.recordAll(collection, count, "skipped", reason);
    }
    // Streamed straight from the archive at write time; verified chunk by chunk.
    plan.ledger.recordAll(GRIDFS_CHUNKS, plan.source.chunkCount, "inserted", "GridFS chunks, copied byte for byte");
}

async function resolveTarget(plan: ImportPlan): Promise<boolean> {
    const wanted = plan.options.targetCompany.trim();
    const filter = ObjectId.isValid(wanted) && /^[0-9a-f]{24}$/i.test(wanted)
        ? {_id: new ObjectId(wanted)}
        : {$or: [{vat: wanted}, {name: wanted}]};
    const matches = (await raw("companies").find({...filter, deletedAt: null}).toArray()) as Doc[];
    if (matches.length !== 1) {
        plan.errors.push(matches.length === 0 ? `Target company "${wanted}" not found` : `Target company "${wanted}" matches ${matches.length} companies; pass its id`);
        return false;
    }
    const company = matches[0];
    if (company.isActive === false) plan.errors.push(`Target company ${company.name} is not active`);
    const modules = effectiveCompanyModules({modules: company.modules as string[] | undefined});
    if (!modules.includes("propertyManagement")) plan.errors.push(`Target company ${company.name} does not have the propertyManagement module (grant it first)`);

    const platform = await raw("companies").findOne({isPlatformOwner: true, isActive: true, deletedAt: null});
    if (!platform) {
        plan.errors.push("No active platform-owner company: currencies and places are its lists (D160)");
        return false;
    }

    const timeZone = plan.options.timeZone ?? (typeof company.timezone === "string" && company.timezone ? company.timezone : undefined);
    if (!timeZone) {
        plan.errors.push(`Target company ${company.name} has no timezone: set it, or pass --timezone <IANA zone> (it decides the calendar day of timed old values)`);
    } else {
        try {
            new Intl.DateTimeFormat("en-US", {timeZone});
        } catch {
            plan.errors.push(`Unknown timezone "${timeZone}"`);
        }
    }
    plan.target = {company, platformId: platform._id as ObjectId, timeZone: timeZone ?? "UTC", modules, sameEncryptionKey: true};
    return true;
}

function checkEncryption(plan: ImportPlan): void {
    const legacyKey = plan.options.legacyEncryptionKey;
    const targetKey = plan.options.targetEncryptionKey;
    plan.target.sameEncryptionKey = legacyKey === targetKey;
    let checked = 0;
    for (const [collection, paths] of Object.entries(ENCRYPTED_FIELDS)) {
        for (const doc of plan.source.docs.get(collection) ?? []) {
            for (const path of paths) {
                mapPath(doc, path, (value) => {
                    if (!isEncryptedPayload(value)) return value;
                    checked += 1;
                    try {
                        if (!legacyKey) throw new Error("no key");
                        decryptWithKey(value, legacyKey);
                    } catch {
                        plan.errors.push(`${collection} ${doc._id} ${path} does not decrypt with the legacy ENCRYPTION_KEY (set LEGACY_ENCRYPTION_KEY to the old instance's key)`);
                    }
                    return value;
                });
            }
        }
    }
    note(plan, "Encryption", `${checked} encrypted values decrypt with the legacy key; ${plan.target.sameEncryptionKey ? "the keys are the same, so they are copied unchanged" : "they are re-encrypted with this instance's key"}.`);
}

// ------------------------------------------------------------------------------------------------ companies

interface CompanyMapping {
    oldRoot: Doc;
    /** The target and the recreated sub-companies: records already under them mean an earlier run. */
    ownCompanyIds: Set<string>;
    names: Map<string, string>;
}

async function mapCompanies(plan: ImportPlan, companies: Doc[]): Promise<CompanyMapping> {
    const target = plan.target.company;
    const roots = companies.filter((company) => !company.parentCompany);
    if (roots.length !== 1) throw new Error(`The archive holds ${roots.length} root companies; one is expected`);
    const oldRoot = roots[0];
    plan.idMap.set(oldRoot._id, target._id);
    plan.ledger.record("companies", oldRoot._id, "merged", `into the target company ${target.name}`);
    const ownCompanyIds = new Set([String(target._id)]);
    const names = new Map([[String(target._id), String(target.name)]]);

    for (const company of companies) {
        if (company === oldRoot) continue;
        if (String(company.parentCompany) !== String(oldRoot._id)) {
            plan.errors.push(`Company ${company.name} is neither the root nor its sub-company`);
            continue;
        }
        let newId = company._id;
        const sameId = await raw("companies").findOne({_id: company._id});
        if (sameId) {
            if (String(sameId.parentCompany) === String(target._id) && sameId.vat === company.vat) {
                plan.errors.push(`Sub-company ${company.name} already exists under the target: this archive was imported before (roll that run back first)`);
            }
            newId = new ObjectId();
            plan.idRemaps.push({collection: "companies", from: String(company._id), to: String(newId), reason: "id held by another company"});
            plan.idMap.set(company._id, newId);
        }
        const sameVat = await raw("companies").findOne({vat: company.vat, deletedAt: null});
        if (sameVat) plan.errors.push(`Sub-company ${company.name}: VAT ${company.vat} already belongs to company "${sameVat.name}" (VAT is unique)`);
        ownCompanyIds.add(String(newId));
        names.set(String(newId), String(company.name));

        const doc: Doc = {
            _id: newId,
            name: company.name,
            vat: company.vat,
            isActive: company.isActive !== false,
            isDefaultForSignUp: company.isDefaultForSignUp === true,
            allowedDomains: company.allowedDomains ?? [],
            addresses: company.addresses ?? [],
            parentCompany: target._id,
            company: target._id,
            timezone: plan.target.timeZone,
            ...(Array.isArray(target.modules) ? {modules: target.modules} : {}),
        };
        for (const field of ["email", "phoneNumber", "description", "website", "linkedin", "instagram", "facebook", "publicAiChat"]) {
            if (!isEmpty(company[field])) doc[field] = company[field];
        }
        plan.subCompanies.push({
            oldId: company._id,
            doc,
            restore: {createdBy: company.createdBy as ObjectId | undefined, createdAt: company.createdAt as Date | undefined, updatedAt: company.updatedAt as Date | undefined},
        });
        plan.ledger.record("companies", company._id, "inserted", "recreated as a sub-company of the target");
        // Bots and default roles exist once the company is saved; until then they are placeholders.
        plan.placeholders.push({id: new ObjectId(), company: newId, kind: "bot"});
        note(plan, "Companies", `Sub-company "${company.name}" (VAT ${company.vat}) is recreated under the target, id ${newId}; its default roles, bot and cron jobs are created by the new system.`);
    }

    planProfileUpdate(plan, oldRoot);
    return {oldRoot, ownCompanyIds, names};
}

function planProfileUpdate(plan: ImportPlan, oldRoot: Doc): void {
    const target = plan.target.company;
    const set: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
        const oldValue = oldRoot[field];
        if (isEmpty(oldValue)) continue;
        if (isEmpty(target[field])) {
            set[field] = oldValue;
            note(plan, "Target company profile", `Filled ${field} from Pronix.`);
        } else if (ejson(target[field]) !== ejson(oldValue)) {
            note(plan, "Target company profile", `Kept the target's ${field}; Pronix had ${ejson(oldValue)}.`);
        }
    }
    const oldChat = oldRoot.publicAiChat;
    if (isPlainObject(oldChat)) {
        const targetChat = target.publicAiChat;
        if (!isPlainObject(targetChat)) {
            set.publicAiChat = oldChat;
            note(plan, "Target company profile", "Filled publicAiChat (website chat settings) from Pronix.");
        } else {
            for (const [key, value] of Object.entries(oldChat)) {
                if (key === "_id") continue;
                if (isEmpty(targetChat[key]) && !isEmpty(value)) {
                    set[`publicAiChat.${key}`] = value;
                    note(plan, "Target company profile", `Filled publicAiChat.${key} from Pronix.`);
                } else if (ejson(targetChat[key] ?? null) !== ejson(value ?? null)) {
                    note(plan, "Target company profile", `Kept the target's publicAiChat.${key} (${ejson(targetChat[key] ?? null)}); Pronix had ${ejson(value ?? null)}.`);
                }
            }
        }
    }
    for (const field of ["isDefaultForSignUp", "isActive", "vat", "name"]) {
        if (ejson(target[field] ?? null) !== ejson(oldRoot[field] ?? null)) {
            note(plan, "Target company profile", `Kept the target's ${field} (${ejson(target[field] ?? null)}); Pronix had ${ejson(oldRoot[field] ?? null)}.`);
        }
    }
    if (Object.keys(set).length > 0) plan.profileUpdate = {collection: "companies", id: target._id, set, reason: "fill empty profile fields from Pronix"};
}

/** Company values can name places, media and users, so they are remapped once every mapping is decided. */
function finalizeCompanies(plan: ImportPlan): void {
    if (plan.profileUpdate) plan.profileUpdate.set = plan.idMap.remap(plan.profileUpdate.set);
    for (const sub of plan.subCompanies) {
        sub.doc = plan.idMap.remap(sub.doc);
        sub.restore = plan.idMap.remap(sub.restore);
    }
}

// ------------------------------------------------------------------------------------------------ platform lists (D160)

async function mapCurrencies(plan: ImportPlan, currencies: Doc[]): Promise<void> {
    const batch: InsertBatch = {source: "currencies", collection: Currency.collection.collectionName, model: Currency, docs: []};
    for (const currency of currencies) {
        const code = String(currency.abbreviation ?? "").toUpperCase();
        const existing = await raw(batch.collection).findOne({abbreviation: code, deletedAt: null});
        if (existing) {
            if (String(existing.company) !== String(plan.target.platformId)) {
                plan.errors.push(`Currency ${code} exists outside the platform company (company ${existing.company}); a platform list row is needed (D160)`);
            } else if (UNUSABLE_REQUEST_STATUSES.includes(String(existing.requestStatus))) {
                plan.errors.push(`Currency ${code} exists on the platform list but is ${existing.requestStatus}; approve it first`);
            }
            plan.idMap.set(currency._id, existing._id as ObjectId);
            plan.ledger.record("currencies", currency._id, "merged", "into the platform currency with the same code");
            if (Number(existing.decimalPlaces ?? 2) !== Number(currency.decimalPlaces ?? 2)) {
                note(plan, "Currencies", `${code}: the platform row has ${existing.decimalPlaces} decimals, Pronix had ${currency.decimalPlaces}; amounts are kept exactly.`);
            }
            note(plan, "Currencies", `${code} → platform currency ${existing._id}.`);
            continue;
        }
        const idTaken = await raw(batch.collection).findOne({_id: currency._id});
        const newId = idTaken ? new ObjectId() : currency._id;
        plan.idMap.set(currency._id, newId);
        batch.docs.push({
            _id: newId, name: currency.name, symbol: currency.symbol, abbreviation: code, decimalPlaces: currency.decimalPlaces ?? 2,
            company: plan.target.platformId, requestStatus: "approved", deletedAt: null,
            createdAt: currency.createdAt, updatedAt: currency.updatedAt,
        });
        plan.ledger.record("currencies", currency._id, "inserted", "created on the platform list");
        note(plan, "Currencies", `${code} is not on the platform list: created as a platform currency (${currency.name}, ${currency.symbol}, ${currency.decimalPlaces ?? 2} decimals).`);
    }
    plan.platformRows.push(batch);
}

/** Countries, states and cities: only the rows imported records point at are needed; the rest are compared and listed. */
async function mapPlaces(plan: ImportPlan): Promise<void> {
    const countries = plan.source.docs.get("countries") ?? [];
    const states = plan.source.docs.get("states") ?? [];
    const cities = plan.source.docs.get("cities") ?? [];
    const countryById = new Map(countries.map((row) => [String(row._id), row]));
    const stateById = new Map(states.map((row) => [String(row._id), row]));
    const cityById = new Map(cities.map((row) => [String(row._id), row]));

    // Every place id an imported document points at, and the parents those rows need.
    const wanted = new Set<string>();
    for (const [collection, list] of plan.source.docs) {
        if (["countries", "states", "cities", "auditlogs"].includes(collection)) continue;
        for (const doc of list) {
            for (const {id} of collectReferences(doc)) {
                const hex = String(id);
                if (countryById.has(hex) || stateById.has(hex) || cityById.has(hex)) wanted.add(hex);
            }
        }
    }
    for (const hex of [...wanted]) {
        const city = cityById.get(hex);
        if (city?.state) wanted.add(String(city.state));
        if (city?.country) wanted.add(String(city.country));
    }
    for (const hex of [...wanted]) {
        const state = stateById.get(hex);
        if (state?.country) wanted.add(String(state.country));
    }

    const platformId = plan.target.platformId;
    const usable = {company: platformId, deletedAt: null, requestStatus: {$nin: UNUSABLE_REQUEST_STATUSES}};
    const platformCountries = (await raw(Country.collection.collectionName).find(usable, {projection: {code: 1}}).toArray()) as Doc[];
    const platformStates = (await raw(State.collection.collectionName).find(usable, {projection: {code: 1, name: 1, country: 1}}).toArray()) as Doc[];
    const platformCities = (await raw(City.collection.collectionName).find(usable, {projection: {name: 1, state: 1, country: 1}}).toArray()) as Doc[];
    const countryByCode = new Map(platformCountries.map((row) => [String(row.code).toUpperCase(), row._id]));
    const stateByKey = new Map<string, ObjectId>();
    for (const row of platformStates) {
        if (row.code) stateByKey.set(`${row.country}|code|${String(row.code).toUpperCase()}`, row._id);
        stateByKey.set(`${row.country}|name|${placeKey(row.name)}`, row._id);
    }
    const cityByKey = new Map(platformCities.map((row) => [`${row.country}|${row.state ?? ""}|${placeKey(row.name)}`, row._id]));

    const countryBatch: InsertBatch = {source: "countries", collection: Country.collection.collectionName, model: Country, docs: []};
    const stateBatch: InsertBatch = {source: "states", collection: State.collection.collectionName, model: State, docs: []};
    const cityBatch: InsertBatch = {source: "cities", collection: City.collection.collectionName, model: City, docs: []};
    const missing = {countries: 0, states: 0, cities: 0};
    const created = async (batch: InsertBatch, old: Doc, fields: Record<string, unknown>): Promise<ObjectId> => {
        const idTaken = await raw(batch.collection).findOne({_id: old._id});
        const newId = idTaken ? new ObjectId() : old._id;
        batch.docs.push({_id: newId, ...fields, company: platformId, requestStatus: "approved", deletedAt: null, createdAt: old.createdAt, updatedAt: old.updatedAt});
        return newId;
    };

    const countryOf = (oldId: unknown): ObjectId | undefined => (oldId ? plan.idMap.get(String(oldId)) ?? undefined : undefined);
    for (const country of countries) {
        const match = countryByCode.get(String(country.code).toUpperCase());
        const isWanted = wanted.has(String(country._id));
        if (match) {
            plan.idMap.set(country._id, match);
            plan.ledger.record("countries", country._id, "merged", "into the platform country with the same code");
        } else if (isWanted) {
            const newId = await created(countryBatch, country, {name: country.name, code: String(country.code).toUpperCase(), phoneCode: country.phoneCode});
            plan.idMap.set(country._id, newId);
            countryByCode.set(String(country.code).toUpperCase(), newId);
            plan.ledger.record("countries", country._id, "inserted", "created on the platform list (an imported record uses it)");
            note(plan, "Places", `Country ${country.name} (${country.code}) was missing from the platform list: created.`);
        } else {
            missing.countries += 1;
            plan.ledger.record("countries", country._id, "skipped", "per-company copy; not on the platform list and unused");
        }
    }
    for (const state of states) {
        const country = countryOf(state.country);
        const match = country && ((state.code ? stateByKey.get(`${country}|code|${String(state.code).toUpperCase()}`) : undefined) ?? stateByKey.get(`${country}|name|${placeKey(state.name)}`));
        if (match) {
            plan.idMap.set(state._id, match);
            plan.ledger.record("states", state._id, "merged", "into the platform state");
        } else if (wanted.has(String(state._id)) && country) {
            const newId = await created(stateBatch, state, {name: state.name, ...(state.code ? {code: state.code} : {}), country});
            plan.idMap.set(state._id, newId);
            stateByKey.set(`${country}|name|${placeKey(state.name)}`, newId);
            plan.ledger.record("states", state._id, "inserted", "created on the platform list (an imported record uses it)");
            note(plan, "Places", `State ${state.name} was missing from the platform list: created.`);
        } else {
            missing.states += 1;
            plan.ledger.record("states", state._id, "skipped", "per-company copy; not on the platform list and unused");
        }
    }
    for (const city of cities) {
        const country = countryOf(city.country);
        const state = city.state ? plan.idMap.get(String(city.state)) : undefined;
        const match = country && cityByKey.get(`${country}|${state ?? ""}|${placeKey(city.name)}`);
        if (match) {
            plan.idMap.set(city._id, match);
            plan.ledger.record("cities", city._id, "merged", "into the platform city");
        } else if (wanted.has(String(city._id)) && country) {
            const newId = await created(cityBatch, city, {name: city.name, ...(state ? {state} : {}), country});
            plan.idMap.set(city._id, newId);
            plan.ledger.record("cities", city._id, "inserted", "created on the platform list (an imported record uses it)");
            note(plan, "Places", `City ${city.name} was missing from the platform list: created.`);
        } else {
            missing.cities += 1;
            plan.ledger.record("cities", city._id, "skipped", "per-company copy; not on the platform list and unused");
        }
    }
    note(plan, "Places", `Platform list used for ${wanted.size} referenced places. Unused Pronix rows absent from the platform list (not imported, still in the archive): ${missing.countries} countries, ${missing.states} states, ${missing.cities} cities.`);
    plan.platformRows.push(countryBatch, stateBatch, cityBatch);
}

// ------------------------------------------------------------------------------------------------ roles, users

/** The catalog is the new system's own (rebuilt at every API start): an old permission is the current one with its tag. */
function mapPermissions(plan: ImportPlan, permissions: Doc[], permissionByTag: Map<string, ObjectId>): Map<string, string> {
    for (const permission of permissions) {
        const current = permissionByTag.get(String(permission.tag));
        if (current) {
            plan.idMap.set(permission._id, current);
            plan.ledger.record("rolepermissions", permission._id, "merged", "into the current permission with the same tag");
        } else {
            plan.ledger.record("rolepermissions", permission._id, "skipped", "the permission no longer exists");
        }
    }
    return new Map(permissions.map((permission) => [String(permission._id), String(permission.tag)]));
}

async function loadPermissionCatalog(plan: ImportPlan): Promise<Map<string, ObjectId>> {
    const catalog = (await raw("rolepermissions").find({}, {projection: {tag: 1}}).toArray()) as Doc[];
    if (catalog.length === 0) plan.errors.push("The target has no role-permission catalog: start the API once against this database first");
    return new Map(catalog.map((permission) => [String(permission.tag), permission._id]));
}

async function mapRoles(plan: ImportPlan, roles: Doc[], companies: CompanyMapping, tagById: Map<string, string>, permissionByTag: Map<string, ObjectId>): Promise<void> {
    const target = plan.target.company;
    const targetRoles = (await raw("roles").find({company: target._id, deletedAt: null}).toArray()) as Doc[];
    const suffixOf = (slug: unknown): string | undefined => DEFAULT_ROLE_SLUG_PATTERN.exec(String(slug ?? ""))?.[0];
    const targetBySuffix = new Map<string, Doc>();
    for (const role of targetRoles) {
        const suffix = suffixOf(role.slug);
        if (suffix && !targetBySuffix.has(suffix)) targetBySuffix.set(suffix, role);
    }
    const subCompanyIds = new Set(plan.subCompanies.map((sub) => String(sub.doc._id)));
    const missingTags = new Set<string>();
    const plannedSlugs = new Set<string>();

    for (const role of roles) {
        const company = plan.idMap.resolve(role.company as ObjectId);
        const oldTags = (role.permissions as ObjectId[] | undefined ?? []).map((id) => tagById.get(String(id)) ?? `<unknown ${id}>`);
        for (const tag of oldTags) if (!permissionByTag.has(tag)) missingTags.add(tag);
        const suffix = suffixOf(role.slug);
        const isSub = subCompanyIds.has(String(company));
        const counterpart = suffix ? targetBySuffix.get(suffix) : undefined;
        const companyName = companies.names.get(String(company)) ?? String(company);

        if (suffix && counterpart) {
            if (isSub) {
                const placeholder: Placeholder = {id: new ObjectId(), company, kind: "role", suffix};
                plan.placeholders.push(placeholder);
                plan.idMap.set(role._id, placeholder.id);
            } else {
                plan.idMap.set(role._id, counterpart._id);
            }
            plan.ledger.record("roles", role._id, "merged", "into the default role with the same suffix");
            // Access the old role gave that the new default role does not (permissions that still exist).
            const currentTags = new Set((counterpart.permissions as ObjectId[] | undefined ?? []).map(String));
            const narrowed = oldTags.filter((tag) => {
                const id = permissionByTag.get(tag);
                return id !== undefined && !currentTags.has(String(id));
            });
            if (narrowed.length > 0) {
                note(plan, "Roles", `${companyName} "${role.name}" (${suffix}): the new default role lacks ${narrowed.length} permissions the old one had, e.g. ${narrowed.slice(0, 5).join(", ")}.`);
            }
            continue;
        }
        // Not a default role any more (or never one): kept as the company's own role. A former default role keeps
        // its old key, so two that share a display name stay apart; a custom role is slugged as the panel slugs it.
        const base = companyName.toLowerCase().replace(/ /g, "_");
        let slug = suffix ? `${base}:${suffix.split(":").pop()}` : `${base}:${String(role.name).toLowerCase().replace(/ /g, "_")}`;
        const existing = isSub ? null : await raw("roles").findOne({company, slug, deletedAt: null});
        if (existing) {
            plan.idMap.set(role._id, existing._id as ObjectId);
            plan.ledger.record("roles", role._id, "merged", `into the target's own role ${slug}`);
            continue;
        }
        for (let copy = 2; plannedSlugs.has(`${company}|${slug}`); copy += 1) slug = `${slug.replace(/_\d+$/, "")}_${copy}`;
        plannedSlugs.add(`${company}|${slug}`);
        const permissions = oldTags.map((tag) => permissionByTag.get(tag)).filter((id): id is ObjectId => id !== undefined);
        plan.roles.docs.push({...role, slug, permissions, company});
        plan.ledger.record("roles", role._id, "inserted", "imported as the company's own role");
        note(plan, "Roles", `${companyName} "${role.name}" is not a default role any more: imported as its own role ${slug} with ${permissions.length} of ${oldTags.length} permissions.`);
    }
    if (missingTags.size > 0) {
        note(plan, "Roles", `${missingTags.size} old permissions no longer exist in the new system and are left out of every role: ${[...missingTags].sort().join(", ")}.`);
    }
}

async function mapUsers(plan: ImportPlan, users: Doc[]): Promise<void> {
    const target = plan.target.company;
    const targetBot = await raw("users").findOne({isBot: true, companies: target._id});
    const botPlaceholders = new Map(plan.placeholders.filter((placeholder) => placeholder.kind === "bot").map((placeholder) => [String(placeholder.company), placeholder.id]));
    for (const user of users) {
        if (user.isBot === true) {
            const company = plan.idMap.resolve((user.companies as ObjectId[] | undefined)?.[0] ?? (user.registeredFrom as ObjectId));
            const bot = String(company) === String(target._id) ? (targetBot?._id as ObjectId | undefined) : botPlaceholders.get(String(company));
            if (bot) {
                plan.idMap.set(user._id, bot);
                plan.ledger.record("users", user._id, "merged", "into the company's bot of the new system");
                continue;
            }
        }
        const existing = await raw("users").findOne({username: user.username});
        if (existing) {
            plan.idMap.set(user._id, existing._id as ObjectId);
            plan.ledger.record("users", user._id, "merged", "into the existing account with the same username");
            note(plan, "Users", `${user.username} already has an account: memberships and roles added to it; its own password and profile are kept.`);
            continue;
        }
        const nearMatch = await raw("users").findOne({username: {$regex: `^${escapeRegex(String(user.username))}$`, $options: "i"}});
        if (nearMatch) note(plan, "Users", `${user.username} is imported as a new account; an account differing only in letter case exists (${nearMatch.username}).`);
        plan.ledger.record("users", user._id, "inserted");
    }
}

/** Unit type categories, unit types and story types the target already has (seeded defaults) are reused by name. */
async function mapLookups(plan: ImportPlan): Promise<void> {
    const target = plan.target.company._id;
    for (const collection of ["unittypecategories", "unittypes", "storytypes"]) {
        for (const doc of plan.source.docs.get(collection) ?? []) {
            const existing = await raw(collection).findOne({company: target, deletedAt: null, name: {$regex: `^${escapeRegex(String(doc.name).trim())}$`, $options: "i"}});
            if (!existing) continue;
            plan.idMap.set(doc._id, existing._id as ObjectId);
            plan.ledger.record(collection, doc._id, "merged", "into the target's row with the same name");
            note(plan, "Lookups", `${collection} "${doc.name}" → the target's existing "${existing.name}".`);
        }
    }
    const config = await raw(PropertyManagementConfig.collection.collectionName).findOne({company: target, deletedAt: null});
    for (const doc of plan.source.docs.get("propertymanagementconfigs") ?? []) {
        if (!config) continue;
        plan.idMap.set(doc._id, config._id as ObjectId);
        plan.ledger.record("propertymanagementconfigs", doc._id, "merged", "the target's own settings are kept");
        for (const key of ["requiresSaleApproval", "requiresHandoverPackageForHandover"]) {
            if (ejson(config[key] ?? null) !== ejson(doc[key] ?? null)) note(plan, "Lookups", `Property settings: kept the target's ${key} (${ejson(config[key] ?? null)}); Pronix had ${ejson(doc[key] ?? null)}.`);
        }
    }
}

/** A user has one AI-assistant chat per company (unique index): a merged user's old one joins the existing one. */
async function mapAiChannels(plan: ImportPlan, channels: Doc[]): Promise<void> {
    for (const channel of channels) {
        if (channel.isAiAssistant !== true || !channel.aiOwnerUser) continue;
        const company = plan.idMap.resolve(channel.company as ObjectId);
        const owner = plan.idMap.resolve(channel.aiOwnerUser as ObjectId);
        const existing = await raw("channels").findOne({company, aiOwnerUser: owner, isAiAssistant: true});
        if (!existing) continue;
        plan.idMap.set(channel._id, existing._id as ObjectId);
        plan.ledger.record("channels", channel._id, "merged", "into the user's existing AI-assistant chat");
        note(plan, "Chats", `AI-assistant chat of user ${owner} joins the one the user already has; its messages move there.`);
    }
}

/**
 * Keeps every `_id` that is free. An id already held by another company's record gets a fresh one (references follow
 * through the id map); a record already under the target with the same creation time means an earlier run.
 */
async function resolveIdCollisions(plan: ImportPlan, ownCompanyIds: Set<string>): Promise<void> {
    const candidates: Array<[string, string, Doc[]]> = [
        ["users", "users", (plan.source.docs.get("users") ?? []).filter((user) => plan.ledger.outcomeOf("users", user._id) !== "merged")],
        ["roles", "roles", (plan.source.docs.get("roles") ?? []).filter((role) => plan.ledger.outcomeOf("roles", role._id) !== "merged")],
        [GRIDFS_FILES, GRIDFS_FILES, plan.source.docs.get(GRIDFS_FILES) ?? []],
        ...IMPORTED_COLLECTIONS.map(([source, model]): [string, string, Doc[]] => [source, model.collection.collectionName, (plan.source.docs.get(source) ?? []).filter((doc) => plan.ledger.outcomeOf(source, doc._id) === undefined)]),
    ];
    for (const [source, collection, list] of candidates) {
        for (let start = 0; start < list.length; start += 500) {
            const slice = list.slice(start, start + 500);
            const byId = new Map(slice.map((doc) => [String(doc._id), doc]));
            const taken = await raw(collection).find({_id: {$in: slice.map((doc) => doc._id)}}, {projection: {_id: 1, company: 1, createdAt: 1, uploadDate: 1, username: 1}}).toArray();
            for (const existing of taken) {
                const old = byId.get(String(existing._id));
                if (!old) continue;
                const sameRecord = (existing.company && ownCompanyIds.has(String(existing.company)) && ejson(existing.createdAt ?? null) === ejson(old.createdAt ?? null))
                    || (collection === GRIDFS_FILES && ejson(existing.uploadDate ?? null) === ejson(old.uploadDate ?? null));
                if (sameRecord) {
                    plan.errors.push(`${source} ${old._id} is already in the target: this archive was imported before (roll that run back first)`);
                    continue;
                }
                const newId = new ObjectId();
                plan.idMap.set(old._id, newId);
                plan.idRemaps.push({collection: source, from: String(old._id), to: String(newId), reason: existing.company ? `id held by a record of company ${existing.company}` : "id held by another record"});
            }
        }
    }
    if (plan.idRemaps.length > 0) note(plan, "Ids", `${plan.idRemaps.length} records get a new id because another record already holds theirs (listed in report.json); every reference to them follows.`);
}

function retireCollections(plan: ImportPlan): void {
    for (const [collection, reason] of RETIRED_COLLECTIONS) {
        const docs = plan.source.docs.get(collection) ?? [];
        for (const doc of docs) plan.ledger.record(collection, doc._id, "skipped", reason);
        if (docs.length > 0) note(plan, "Retired", `${docs.length} ${collection}: ${reason}.`);
    }
}

// ------------------------------------------------------------------------------------------------ prepare documents

/**
 * New accounts become documents; merged accounts become membership updates. A membership keeps only roles that
 * exist after the import (a mapped default role, a sub-company's placeholder, an imported own role): a role id that
 * already pointed at nothing in Pronix is left out, since the user schema refuses a membership role of no company.
 */
function prepareUsers(plan: ImportPlan, users: Doc[]): void {
    // Every old role resolves to the role it becomes (a default role, a placeholder, or itself imported).
    const roleIds = new Set((plan.source.docs.get("roles") ?? []).map((role) => String(plan.idMap.resolve(role._id))));
    const knownRole = (id: ObjectId): boolean => roleIds.has(String(id));
    const droppedRoles: string[] = [];

    const membership = (entry: Record<string, unknown>, username: unknown): Record<string, unknown> => {
        const remapped = plan.idMap.remap(entry);
        const roles: ObjectId[] = [];
        for (const id of (remapped.roles as ObjectId[] | undefined) ?? []) {
            if (!knownRole(id)) {
                droppedRoles.push(`${username}: ${id}`);
                continue;
            }
            if (!roles.some((kept) => String(kept) === String(id))) roles.push(id);
        }
        return {...remapped, roles, rolesCount: roles.length};
    };
    const dedupe = (ids: ObjectId[]): ObjectId[] => ids.filter((id, index) => ids.findIndex((other) => String(other) === String(id)) === index);

    for (const user of users) {
        const memberships = ((user.roles as Record<string, unknown>[] | undefined) ?? []).map((entry) => membership(entry, user.username));
        const companies = dedupe(((user.companies as ObjectId[] | undefined) ?? []).map((id) => plan.idMap.resolve(id)));
        if (plan.ledger.outcomeOf("users", user._id) === "merged") {
            // A bot became the new company's own bot; an account with the same username gains the memberships,
            // merged against its state at write time.
            if (user.isBot !== true) plan.userUpdates.push({collection: "users", id: plan.idMap.resolve(user._id), set: {companies, roles: memberships}, reason: `merge ${user.username}`});
            continue;
        }
        // `finance` pointed at the retired per-user wallets (listed with them in the report).
        const doc = plan.idMap.remap(user);
        delete doc.finance;
        doc.roles = memberships;
        doc.companies = companies;
        plan.users.docs.push(doc);
    }
    if (droppedRoles.length > 0) note(plan, "Users", `Memberships pointed at ${droppedRoles.length} roles that no longer existed in Pronix either; those role ids are left out: ${droppedRoles.slice(0, 10).join("; ")}.`);
}

function prepareGridFsFiles(plan: ImportPlan, files: Doc[]): void {
    for (const file of files) {
        plan.gridFsFiles.docs.push(plan.idMap.remap(file));
        plan.ledger.record(GRIDFS_FILES, file._id, "inserted");
        if (!plan.source.chunkDigests.has(String(file._id)) && Number(file.length) > 0) {
            plan.errors.push(`GridFS file ${file._id} (${file.filename}) has no chunks in the archive`);
        }
    }
}

/**
 * Merges the schema's defaults into `ours` without changing any value we carry: missing paths get the default
 * (except a date, which would invent a time), and a value the schema would cast differently is reported, then taken
 * from the cast unless it is an amount.
 */
function mergeDefaults(ours: unknown, casted: unknown, path: string, out: {defaults: string[]; casts: string[]; unknown: string[]; errors: string[]}): unknown {
    if (isPlainObject(ours) && isPlainObject(casted)) {
        const merged: Record<string, unknown> = {...ours};
        for (const [key, value] of Object.entries(ours)) {
            // A field the current schema no longer has is kept: nothing is dropped (Mongoose ignores it on read).
            const isEmptyObject = isPlainObject(value) && Object.keys(value).length === 0;
            if (!(key in casted) && !isEmptyObject && value !== null) out.unknown.push(path ? `${path}.${key}` : key);
        }
        for (const [key, value] of Object.entries(casted)) {
            const child = path ? `${path}.${key}` : key;
            if (!(key in ours)) {
                if (value instanceof Date || value === undefined) continue;
                merged[key] = value;
                out.defaults.push(child);
            } else {
                merged[key] = mergeDefaults(ours[key], value, child, out);
            }
        }
        return merged;
    }
    if (Array.isArray(ours) && Array.isArray(casted) && ours.length === casted.length) {
        return ours.map((item, index) => mergeDefaults(item, casted[index], `${path}[]`, out));
    }
    if (ejson(ours ?? null) === ejson(casted ?? null)) return ours;
    if (ours instanceof Decimal128 || casted instanceof Decimal128) {
        out.errors.push(`${path}: the current schema would change the amount ${ejson(ours)} to ${ejson(casted)}`);
        return ours;
    }
    out.casts.push(`${path}: ${ejson(ours)} → ${ejson(casted)}`);
    return casted;
}

/**
 * Remaps, converts, validates and completes one document against its current model. `built` documents (users,
 * own roles, platform rows) were assembled from mapped values already and are not remapped a second time.
 */
function prepareDocument(plan: ImportPlan, source: string, model: Model<any>, old: Doc, summary: Map<string, number>, built = false): Doc {
    const doc = built ? old : plan.idMap.remap(old);
    for (const conversion of conformToSchema(model.schema, doc, plan.target.timeZone)) {
        plan.conversions.push({...conversion, collection: source, id: String(old._id)});
        if (conversion.kind === "localDay" && !isLocalDay(conversion.to)) plan.errors.push(`${source} ${old._id} ${conversion.path}: "${conversion.to}" is not a calendar day`);
    }
    for (const path of ENCRYPTED_FIELDS[source] ?? []) {
        mapPath(doc, path, (value) => {
            if (!isEncryptedPayload(value) || plan.target.sameEncryptionKey || !plan.options.legacyEncryptionKey) return value;
            return EncryptString(decryptWithKey(value, plan.options.legacyEncryptionKey));
        });
    }
    const hydrated = new model(doc);
    const invalid = hydrated.validateSync();
    if (invalid) {
        for (const [path, error] of Object.entries(invalid.errors)) plan.errors.push(`${source} ${old._id} ${path}: ${String(error)}`);
    }
    const out = {defaults: [] as string[], casts: [] as string[], unknown: [] as string[], errors: [] as string[]};
    const final = mergeDefaults(doc, hydrated.toObject({depopulate: true, virtuals: false, getters: false}), "", out) as Doc;
    for (const error of out.errors) plan.errors.push(`${source} ${old._id} ${error}`);
    const count = (line: string): void => {
        summary.set(line, (summary.get(line) ?? 0) + 1);
    };
    for (const path of out.defaults) count(`${source}: schema default added for ${path}`);
    for (const cast of out.casts) count(`${source}: value normalized by the current schema at ${cast.split(":")[0]}`);
    for (const path of out.unknown) count(`${source}: kept ${path}, a field the current schema no longer has`);
    return final;
}

async function prepareBatches(plan: ImportPlan): Promise<void> {
    const summary = new Map<string, number>();
    for (const doc of plan.users.docs.splice(0)) plan.users.docs.push(prepareDocument(plan, "users", User, doc, summary, true));
    for (const doc of plan.roles.docs.splice(0)) plan.roles.docs.push(prepareDocument(plan, "roles", Role, doc, summary));
    for (const batch of plan.platformRows) {
        for (const doc of batch.docs.splice(0)) if (batch.model) batch.docs.push(prepareDocument(plan, batch.source, batch.model, doc, summary, true));
    }
    for (const sub of plan.subCompanies) {
        const invalid = new Company(sub.doc).validateSync();
        if (invalid) for (const [path, error] of Object.entries(invalid.errors)) plan.errors.push(`companies ${sub.oldId} ${path}: ${String(error)}`);
    }

    const markers = new Map<string, Doc>();
    for (const [source, model] of IMPORTED_COLLECTIONS) {
        const batch: InsertBatch = {source, collection: model.collection.collectionName, model, docs: []};
        for (const old of plan.source.docs.get(source) ?? []) {
            if (plan.ledger.outcomeOf(source, old._id) === "merged") continue;
            if (source === "auditlogs" && AUDIT_SKIPPED_COLLECTIONS.has(String(old.collectionName))) {
                plan.ledger.record(source, old._id, "skipped", "audit entry about a collection that is not imported");
                continue;
            }
            const doc = prepareDocument(plan, source, model, old, summary);
            if (source === "smtpservers") {
                const sameName = await raw(batch.collection).findOne({company: doc.company, name: doc.name, deletedAt: null});
                if (sameName) {
                    plan.ledger.record(source, old._id, "merged", "the target already has a mail server with this name");
                    note(plan, "Mail", `Mail server "${doc.name}" exists in the target already: kept the target's.`);
                    continue;
                }
                note(plan, "Mail", `Mail server "${doc.name}" imported; it only sends when the target is the platform owner (D161).`);
            }
            if (source === "lastchannelreadmessages") {
                const key = `${doc.user}|${doc.channel}`;
                const existing = markers.get(key) ?? (await raw(batch.collection).findOne({user: doc.user, channel: doc.channel}));
                if (existing) {
                    const later = (doc.time as Date | undefined)?.getTime() ?? 0;
                    if (later > ((existing.time as Date | undefined)?.getTime() ?? 0)) {
                        plan.lateUpdates.push({collection: batch.collection, id: existing._id as ObjectId, set: {time: doc.time}, reason: "the later read marker of a merged chat"});
                    }
                    plan.ledger.record(source, old._id, "merged", "into the read marker of the merged chat");
                    continue;
                }
                markers.set(key, doc);
            }
            batch.docs.push(doc);
            plan.ledger.record(source, old._id, "inserted");
        }
        plan.batches.push(batch);
    }
    for (const [line, count] of [...summary].sort()) note(plan, "Schema", `${line} (${count})`);
    const timed = plan.conversions.filter((conversion) => conversion.kind === "localDay" && conversion.hadTimeOfDay);
    const days = plan.conversions.filter((conversion) => conversion.kind === "localDay").length;
    note(plan, "Dates", `${days} calendar values became YYYY-MM-DD strings; ${days - timed.length} were stored at midnight UTC (exact). ${timed.length} carried a time of day and were dated in ${plan.target.timeZone}:`);
    for (const conversion of timed) note(plan, "Dates", `  ${conversion.collection} ${conversion.id} ${conversion.path}: ${conversion.from} → ${conversion.to}`);
}

/** A media row that a public record shows (a project's photos, a unit's plan) must be public, as the plugin would mark it. */
function applyPublicMedia(plan: ImportPlan): void {
    const publicIds = new Set<string>();
    const sources = new Map(getPublicMediaBackfillSources().map((source) => [source.name, source.schemaDef as SchemaDef]));
    for (const batch of plan.batches) {
        const schemaDef = batch.model ? sources.get(batch.model.modelName) : undefined;
        if (!schemaDef) continue;
        for (const doc of batch.docs) for (const id of collectPublicMediaIds(schemaDef, doc)) publicIds.add(String(id));
    }
    let marked = 0;
    for (const doc of plan.batches.find((batch) => batch.source === "media")?.docs ?? []) {
        if (publicIds.has(String(doc._id)) && doc.isPublic !== true) {
            doc.isPublic = true;
            marked += 1;
        }
    }
    note(plan, "Media", `${publicIds.size} media are shown by public records (projects, buildings, floors, units, stories); ${marked} were not yet marked public and are marked now.`);
}

// ------------------------------------------------------------------------------------------------ checks

/** Per currency code, the exact sum of every money amount; computed on the archive and on the prepared documents. */
function computeMoneyTotals(plan: ImportPlan): void {
    const totals = (docsOf: (collection: string) => Doc[], codeOf: (currencyId: unknown) => string): Record<string, string> => {
        const sums = new Map<string, bigint[]>();
        const saleCurrency = new Map(docsOf("sales").map((sale) => [String(sale._id), sale.saleCurrency]));
        for (const [collection, fields] of Object.entries(MONEY_FIELDS)) {
            for (const doc of docsOf(collection)) {
                for (const field of fields) {
                    for (const {amount, currency} of moneyValues(doc, field, (saleId) => saleCurrency.get(String(saleId)))) {
                        const key = `${collection}.${field.amount} ${codeOf(currency)}`;
                        const list = sums.get(key) ?? [];
                        list.push(toMinor(amount as Decimal128, CHECKSUM_DECIMALS));
                        sums.set(key, list);
                    }
                }
            }
        }
        return Object.fromEntries([...sums].sort().map(([key, list]) => [key, `${fromMinor(sumMinor(list), CHECKSUM_DECIMALS)} (${list.length})`]));
    };
    const oldCodes = new Map((plan.source.docs.get("currencies") ?? []).map((currency) => [String(currency._id), String(currency.abbreviation).toUpperCase()]));
    const newCodes = new Map<string, string>();
    for (const [oldId, code] of oldCodes) newCodes.set(String(plan.idMap.resolve(new ObjectId(oldId))), code);
    const preparedOf = (collection: string): Doc[] => {
        const batch = plan.batches.find((candidate) => candidate.source === collection);
        // Merged rows are not in the batch; the archive copy stands for them.
        const merged = (plan.source.docs.get(collection) ?? []).filter((doc) => plan.ledger.outcomeOf(collection, doc._id) === "merged").map((doc) => plan.idMap.remap(doc));
        return [...(batch?.docs ?? []), ...merged];
    };
    plan.moneyTotals = {
        source: totals((collection) => plan.source.docs.get(collection) ?? [], (id) => oldCodes.get(String(id)) ?? `<no currency ${id ?? ""}>`),
        imported: totals(preparedOf, (id) => newCodes.get(String(id)) ?? `<no currency ${id ?? ""}>`),
    };
    for (const key of new Set([...Object.keys(plan.moneyTotals.source), ...Object.keys(plan.moneyTotals.imported)])) {
        if (plan.moneyTotals.source[key] !== plan.moneyTotals.imported[key]) plan.errors.push(`Money total differs for ${key}: archive ${plan.moneyTotals.source[key]}, imported ${plan.moneyTotals.imported[key]}`);
    }
    // Amounts finer than their currency are kept exactly; listed so they can be reviewed.
    const decimals = new Map<string, number>();
    for (const currency of plan.source.docs.get("currencies") ?? []) decimals.set(String(plan.idMap.resolve(currency._id)), Number(currency.decimalPlaces ?? 2));
    for (const [collection, fields] of Object.entries(MONEY_FIELDS)) {
        const saleCurrency = new Map(preparedOf("sales").map((sale) => [String(sale._id), sale.saleCurrency]));
        for (const doc of preparedOf(collection)) {
            for (const field of fields) {
                for (const {amount, currency} of moneyValues(doc, field, (saleId) => saleCurrency.get(String(saleId)))) {
                    const places = decimals.get(String(currency)) ?? 2;
                    if (toMinor(amount as Decimal128, places) * 10n ** BigInt(CHECKSUM_DECIMALS - places) !== toMinor(amount as Decimal128, CHECKSUM_DECIMALS)) {
                        note(plan, "Money", `${collection} ${doc._id} ${field.amount} = ${amount} has more decimals than its currency (${places}); kept exactly.`);
                    }
                }
            }
        }
    }
}

/**
 * What the propertyManagement cron jobs will do to the imported records on their first run, so nobody is surprised:
 * an active unpaid reservation past its expiry day is expired (its unit freed, its client emailed), and a pending
 * installment past its due day is marked overdue with its late fee.
 */
function forecastCronEffects(plan: ImportPlan): void {
    const today = localDateOf(new Date(), plan.target.timeZone);
    const docsOf = (source: string): Doc[] => plan.batches.find((batch) => batch.source === source)?.docs ?? [];
    const expiring = docsOf("reservations").filter((reservation) => reservation.status === "active" && reservation.paid !== true && !reservation.deletedAt && typeof reservation.expirationDate === "string" && reservation.expirationDate < today);
    const overdue = docsOf("paymentplans").flatMap((paymentPlan) => ((paymentPlan.installments as Array<Record<string, unknown>> | undefined) ?? [])
        .filter((installment) => installment.status === "pending" && typeof installment.dueDate === "string" && installment.dueDate < today)
        .map((installment) => `${paymentPlan.name ?? paymentPlan._id} #${installment.installmentNumber} due ${installment.dueDate}`));
    note(plan, "After the import", `On their first run the cron jobs will expire ${expiring.length} active unpaid reservations already past their expiry day (${today} in ${plan.target.timeZone}), freeing their units and emailing their clients: ${expiring.map((reservation) => `${reservation.name} (expired ${reservation.expirationDate})`).join(", ") || "none"}.`);
    note(plan, "After the import", `They will mark ${overdue.length} pending installments already past due as overdue and add their late fees: ${overdue.join(", ") || "none"}.`);
}

/** The all-zero id: the "no company" both systems write on a failed login (core login.ts) and on company-less audit entries. */
const NO_COMPANY_ID = "000000000000000000000000";

function collectKnownIds(plan: ImportPlan): void {
    const known = plan.knownIds;
    known.add(NO_COMPANY_ID);
    known.add(String(plan.target.company._id));
    known.add(String(plan.target.platformId));
    for (const [, id] of plan.idMap.entries()) known.add(String(id));
    // A row merged into an existing row with the very same id leaves no entry in the id map.
    for (const [collection, docs] of plan.source.docs) {
        for (const doc of docs) if (plan.ledger.outcomeOf(collection, doc._id) === "merged") known.add(String(plan.idMap.resolve(doc._id)));
    }
    for (const placeholder of plan.placeholders) known.add(String(placeholder.id));
    for (const sub of plan.subCompanies) known.add(String(sub.doc._id));
    // Embedded rows' ids too: a sale's checklist item points at a handover package's item by its `_id`.
    const addIds = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(addIds);
        else if (isPlainObject(value)) {
            for (const [key, item] of Object.entries(value)) {
                if (key === "_id" && item instanceof ObjectId) known.add(String(item));
                else addIds(item);
            }
        }
    };
    for (const batch of [...plan.platformRows, plan.roles, plan.users, plan.gridFsFiles, ...plan.batches]) {
        for (const doc of batch.docs) addIds(doc);
    }
    const noCompany = plan.batches.reduce((sum, batch) => sum + batch.docs.filter((doc) => String(doc.company) === NO_COMPANY_ID).length, 0);
    if (noCompany > 0) note(plan, "References", `${noCompany} rows (failed logins, audit entries of company-less records such as accounts) keep the "no company" id, as the new system writes them; no company sees them.`);
}

/**
 * Every ObjectId an imported document holds must point at a row that exists after the import. One that does not
 * is reported: pointing at data that is not imported (telemetry), or already dangling in the archive. One that points
 * at an imported collection yet resolves to nothing is a defect of the import and stops it.
 */
function checkReferences(plan: ImportPlan): void {
    const toSkipped = new Map<string, number>();
    const dangling = new Map<string, number>();
    const check = (source: string, docs: Doc[]): void => {
        for (const doc of docs) {
            for (const {path, id} of collectReferences(doc, HISTORY_PATHS[source] ?? [])) {
                const hex = String(id);
                if (plan.knownIds.has(hex)) continue;
                const owner = plan.source.collectionOf.get(hex);
                const key = `${source}.${path} → ${owner ?? "nothing"}`;
                if (!owner) dangling.set(key, (dangling.get(key) ?? 0) + 1);
                else if (skippedReason(owner) || RETIRED_COLLECTIONS.has(owner)) toSkipped.set(key, (toSkipped.get(key) ?? 0) + 1);
                else plan.errors.push(`${source} ${doc._id} ${path} points at ${owner} ${hex}, which the import does not carry over`);
            }
        }
    };
    check("users", plan.users.docs);
    check("roles", plan.roles.docs);
    for (const batch of plan.batches) check(batch.source, batch.docs);
    for (const [key, count] of dangling) note(plan, "References", `Already dangling in the archive (kept as is): ${key} (${count})`);
    for (const [key, count] of toSkipped) note(plan, "References", `Points at data that is not imported (kept as is): ${key} (${count})`);
}

interface UniqueIndex {
    keys: string[];
    sparse: boolean;
    filter: Record<string, unknown>;
    collation?: Record<string, unknown>;
}

/** The unique indexes a schema declares. Mongoose types `indexes()` loosely; at runtime each entry is `[fields, options]`. */
function uniqueIndexes(model: Model<any>): UniqueIndex[] {
    const entries: unknown[] = model.schema.indexes();
    const found: UniqueIndex[] = [];
    for (const entry of entries) {
        if (!Array.isArray(entry)) continue;
        const [fields, options] = entry;
        if (!isPlainObject(fields) || !isPlainObject(options) || options.unique !== true) continue;
        found.push({
            keys: Object.keys(fields),
            sparse: options.sparse === true,
            filter: isPlainObject(options.partialFilterExpression) ? options.partialFilterExpression : {},
            ...(isPlainObject(options.collation) ? {collation: options.collation} : {}),
        });
    }
    return found;
}

/** Every unique index of every target collection holds after the import: against the target and within the import. */
async function checkUniqueIndexes(plan: ImportPlan): Promise<void> {
    for (const batch of [...plan.platformRows, plan.roles, plan.users, ...plan.batches]) {
        if (!batch.model || batch.docs.length === 0) continue;
        for (const {keys, sparse, filter, collation} of uniqueIndexes(batch.model)) {
            const docs = batch.docs.filter((doc) => (!sparse || keys.every((key) => readDotted(doc, key) !== undefined)) && matchesFilter(doc, filter));
            const seen = new Map<string, ObjectId>();
            for (const doc of docs) {
                const key = ejson(keys.map((field) => readDotted(doc, field) ?? null));
                const first = seen.get(key);
                if (first) plan.errors.push(`${batch.source}: ${doc._id} and ${first} share the unique key ${keys.join("+")} = ${key}`);
                else seen.set(key, doc._id);
            }
            for (let start = 0; start < docs.length; start += 200) {
                const slice = docs.slice(start, start + 200);
                const ids = new Set(slice.map((doc) => String(doc._id)));
                const query = {$and: [filter, {$or: slice.map((doc) => Object.fromEntries(keys.map((field) => [field, readDotted(doc, field) ?? null])))}]};
                const found = await raw(batch.collection).find(query, {projection: Object.fromEntries(keys.map((field) => [field, 1])), ...(collation ? {collation: {locale: String(collation.locale ?? "simple"), ...collation}} : {})}).toArray();
                for (const existing of found) {
                    if (ids.has(String(existing._id))) continue;
                    plan.errors.push(`${batch.source}: an existing ${batch.collection} row ${existing._id} already holds the unique key ${keys.join("+")} = ${ejson(keys.map((field) => readDotted(existing, field) ?? null))}`);
                }
            }
        }
    }
}

/** A non-empty source collection that no rule covers stops the import: nothing is dropped silently. */
function checkUnhandledCollections(plan: ImportPlan): void {
    const covered = new Set([...SPECIAL_COLLECTIONS, ...IMPORTED_COLLECTIONS.map(([source]) => source), ...RETIRED_COLLECTIONS.keys()]);
    for (const [collection, count] of plan.source.summary.counts) {
        if (count === 0 || covered.has(collection) || skippedReason(collection)) continue;
        plan.errors.push(`The archive's ${collection} (${count} documents) is not covered by the import; extend legacyImportPlan.ts before running`);
    }
}
