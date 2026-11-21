/**
 * Writes a legacy import plan (D171), proves what it wrote, and undoes it on demand.
 *
 * Every write is journalled before it is made (inserted ids; an update's before-image; a created company), so a run
 * that fails at any point, or a run the architect wants gone, is undone exactly from the journal. Rows are written
 * with the driver: the validated documents land as they are, keeping their original timestamps, and no hook sends
 * mail, notifies or writes audit entries for history that already happened.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import Company from "@coreModule/database/schemas/company/company";
import {BSON, readArchive} from "./archiveReader";
import {IdMap, isPlainObject} from "./idMap";
import type {Doc, ImportPlan, InsertBatch, UpdateOp} from "./legacyImportPlan";

const INSERT_SLICE = 500;
const CHUNK_FLUSH_BYTES = 8 << 20;

type JournalEntry =
    | {op: "start"; database: string; archive: string; startedAt: Date}
    | {op: "insert"; collection: string; ids: unknown[]}
    | {op: "update"; collection: string; id: ObjectId; before: Doc}
    | {op: "company"; id: ObjectId};

const db = () => {
    const database = mongoose.connection.db;
    if (!database) throw new Error("Not connected to MongoDB");
    return database;
};

const raw = (collection: string) => db().collection(collection);

/** Append-only, one EJSON line per write, flushed before the write it describes. */
export class Journal {
    constructor(readonly file: string) {}

    append(entry: JournalEntry): void {
        fs.appendFileSync(this.file, `${BSON.EJSON.stringify(entry, {relaxed: false})}\n`);
    }

    static read(file: string): JournalEntry[] {
        return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => BSON.EJSON.parse(line, {relaxed: false}) as JournalEntry);
    }
}

export type Log = (message: string) => void;

export interface ExecuteResult {
    /** Placeholder id → the real id once the sub-companies exist. */
    placeholders: IdMap;
    written: InsertBatch[];
    updates: UpdateOp[];
    chunksWritten: number;
}

async function insertBatch(batch: InsertBatch, journal: Journal, log: Log): Promise<void> {
    if (batch.docs.length === 0) return;
    for (let start = 0; start < batch.docs.length; start += INSERT_SLICE) {
        const slice = batch.docs.slice(start, start + INSERT_SLICE);
        journal.append({op: "insert", collection: batch.collection, ids: slice.map((doc) => doc._id)});
        await raw(batch.collection).insertMany(slice, {ordered: true});
    }
    log(`  ${batch.source}: ${batch.docs.length} written`);
}

async function updateWithJournal(update: UpdateOp, journal: Journal): Promise<void> {
    const before = await raw(update.collection).findOne({_id: update.id});
    if (!before) throw new Error(`${update.collection} ${update.id} disappeared before its update (${update.reason})`);
    journal.append({op: "update", collection: update.collection, id: update.id, before: before as Doc});
    await raw(update.collection).updateOne({_id: update.id}, {$set: update.set});
}

/** A merged account's memberships: the existing entry of a company gains the old roles; a new company gets the old entry. */
function mergedMemberships(existing: Doc, add: {companies: ObjectId[]; roles: Array<Record<string, unknown>>}): {companies: ObjectId[]; roles: Array<Record<string, unknown>>} {
    const companies = [...((existing.companies as ObjectId[] | undefined) ?? [])];
    for (const id of add.companies) if (!companies.some((kept) => String(kept) === String(id))) companies.push(id);
    const roles = ((existing.roles as Array<Record<string, unknown>> | undefined) ?? []).map((entry) => ({...entry}));
    for (const entry of add.roles) {
        const current = roles.find((kept) => String(kept.company) === String(entry.company));
        if (!current) {
            roles.push(entry);
            continue;
        }
        const ids = [...((current.roles as ObjectId[] | undefined) ?? [])];
        for (const id of (entry.roles as ObjectId[] | undefined) ?? []) if (!ids.some((kept) => String(kept) === String(id))) ids.push(id);
        current.roles = ids;
        current.rolesCount = ids.length;
    }
    return {companies, roles};
}

/** Writes the plan in dependency order. Throws on the first failure; the caller rolls back from the journal. */
export async function executePlan(plan: ImportPlan, journal: Journal, log: Log): Promise<ExecuteResult> {
    const placeholders = new IdMap();
    const finalize = <T>(value: T): T => placeholders.remap(value);
    const written: InsertBatch[] = [];
    const updates: UpdateOp[] = [];
    journal.append({op: "start", database: db().databaseName, archive: plan.options.archivePath, startedAt: new Date()});

    log("Writing platform list rows…");
    for (const batch of plan.platformRows) {
        await insertBatch(batch, journal, log);
        written.push(batch);
    }

    if (plan.profileUpdate) {
        log("Filling the target company's empty profile fields…");
        await updateWithJournal(plan.profileUpdate, journal);
        updates.push(plan.profileUpdate);
    }

    for (const sub of plan.subCompanies) {
        log(`Creating sub-company ${sub.doc.name}…`);
        journal.append({op: "company", id: sub.doc._id});
        // Saved through the model: its hook creates the default roles, the bot, the AI chats and the cron jobs.
        await new Company(sub.doc).save();
        const restore = Object.fromEntries(Object.entries(sub.restore).filter(([, value]) => value != null));
        if (Object.keys(restore).length > 0) await raw("companies").updateOne({_id: sub.doc._id}, {$set: restore});
        for (const placeholder of plan.placeholders.filter((candidate) => String(candidate.company) === String(sub.doc._id))) {
            const real = placeholder.kind === "bot"
                ? await raw("users").findOne({isBot: true, companies: sub.doc._id}, {projection: {_id: 1}})
                : await raw("roles").findOne({company: sub.doc._id, deletedAt: null, slug: {$regex: `${placeholder.suffix?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`}}, {projection: {_id: 1}});
            if (!real) throw new Error(`Sub-company ${sub.doc.name}: its ${placeholder.kind} ${placeholder.suffix ?? ""} was not created`);
            placeholders.set(placeholder.id, real._id as ObjectId);
        }
    }

    log("Writing roles and users…");
    plan.roles.docs = plan.roles.docs.map(finalize);
    await insertBatch(plan.roles, journal, log);
    written.push(plan.roles);
    plan.users.docs = plan.users.docs.map(finalize);
    await insertBatch(plan.users, journal, log);
    written.push(plan.users);
    for (const update of plan.userUpdates) {
        const existing = await raw("users").findOne({_id: update.id});
        if (!existing) throw new Error(`Account ${update.id} disappeared before its merge`);
        const merged = mergedMemberships(existing as Doc, finalize(update.set) as {companies: ObjectId[]; roles: Array<Record<string, unknown>>});
        const applied: UpdateOp = {...update, set: merged};
        await updateWithJournal(applied, journal);
        updates.push(applied);
    }
    log(`  users: ${plan.userUpdates.length} existing accounts gained memberships`);

    log("Writing files…");
    plan.gridFsFiles.docs = plan.gridFsFiles.docs.map(finalize);
    await insertBatch(plan.gridFsFiles, journal, log);
    written.push(plan.gridFsFiles);
    const chunksWritten = await copyChunks(plan, journal, log);

    log("Writing records…");
    for (const batch of plan.batches) {
        batch.docs = batch.docs.map(finalize);
        await insertBatch(batch, journal, log);
        written.push(batch);
    }
    for (const update of plan.lateUpdates) {
        const applied = finalize(update);
        await updateWithJournal(applied, journal);
        updates.push(applied);
    }
    return {placeholders, written, updates, chunksWritten};
}

/** Second pass over the archive: every GridFS chunk, byte for byte, under its (possibly remapped) file id. */
async function copyChunks(plan: ImportPlan, journal: Journal, log: Log): Promise<number> {
    let pending: Doc[] = [];
    let pendingBytes = 0;
    let written = 0;
    const flush = async (): Promise<void> => {
        if (pending.length === 0) return;
        journal.append({op: "insert", collection: "media.chunks", ids: pending.map((chunk) => chunk._id)});
        await raw("media.chunks").insertMany(pending, {ordered: true});
        written += pending.length;
        pending = [];
        pendingBytes = 0;
    };
    let lastReport = Date.now();
    await readArchive(plan.options.archivePath, async (collection, rawChunk) => {
        if (collection !== "media.chunks") return;
        const chunk = BSON.deserialize(rawChunk) as Doc;
        chunk.files_id = plan.idMap.resolve(chunk.files_id as ObjectId);
        pending.push(chunk);
        pendingBytes += rawChunk.length;
        if (pendingBytes >= CHUNK_FLUSH_BYTES) await flush();
        if (Date.now() - lastReport > 15_000) {
            log(`  media.chunks: ${written} of ${plan.source.chunkCount} written`);
            lastReport = Date.now();
        }
    });
    await flush();
    log(`  media.chunks: ${written} written`);
    return written;
}

// ------------------------------------------------------------------------------------------------ verify

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (isPlainObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
}

const same = (left: unknown, right: unknown): boolean => BSON.EJSON.stringify(canonical(left), {relaxed: false}) === BSON.EJSON.stringify(canonical(right), {relaxed: false});

/**
 * Reads everything back: each written row must equal the planned row exactly (Decimal128 included), each update must
 * hold, and each file's chunks must hash to the archive's. Returns the failures (empty when the import is exact).
 */
export async function verifyWrites(plan: ImportPlan, result: ExecuteResult, log: Log): Promise<string[]> {
    const failures: string[] = [];
    let compared = 0;
    for (const batch of result.written) {
        for (let start = 0; start < batch.docs.length; start += INSERT_SLICE) {
            const slice = batch.docs.slice(start, start + INSERT_SLICE);
            const stored = new Map((await raw(batch.collection).find({_id: {$in: slice.map((doc) => doc._id)}}).toArray()).map((doc) => [String(doc._id), doc]));
            for (const doc of slice) {
                const found = stored.get(String(doc._id));
                if (!found) failures.push(`${batch.source} ${doc._id} is missing after the write`);
                else if (!same(found, doc)) failures.push(`${batch.source} ${doc._id} differs from the planned document after the write`);
                compared += 1;
            }
        }
    }
    for (const update of result.updates) {
        const found = await raw(update.collection).findOne({_id: update.id});
        for (const [path, value] of Object.entries(update.set)) {
            let current: unknown = found;
            for (const step of path.split(".")) current = isPlainObject(current) ? current[step] : undefined;
            if (!same(current, value)) failures.push(`${update.collection} ${update.id} ${path} does not hold the value written (${update.reason})`);
        }
    }
    log(`Verified ${compared} rows and ${result.updates.length} updates field by field.`);

    let chunks = 0;
    for (const [fileId, digests] of plan.source.chunkDigests) {
        const targetId = plan.idMap.resolve(new ObjectId(fileId));
        const stored = await raw("media.chunks").find({files_id: targetId}, {sort: {n: 1}}).toArray();
        if (stored.length !== digests.size) failures.push(`File ${fileId}: ${stored.length} chunks stored, ${digests.size} in the archive`);
        for (const chunk of stored) {
            const data = chunk.data as {buffer: Buffer};
            const digest = crypto.createHash("sha256").update(data.buffer).digest("hex");
            if (digests.get(Number(chunk.n)) !== digest) failures.push(`File ${fileId} chunk ${chunk.n} differs from the archive`);
            chunks += 1;
        }
    }
    if (result.chunksWritten !== plan.source.chunkCount) failures.push(`${result.chunksWritten} chunks written, ${plan.source.chunkCount} in the archive`);
    log(`Verified ${chunks} file chunks against the archive's SHA-256.`);
    return failures;
}

// ------------------------------------------------------------------------------------------------ rollback

/** Undoes a run from its journal, newest write first. Refuses a journal written against another database. */
export async function rollback(journalFile: string, log: Log): Promise<void> {
    const entries = Journal.read(journalFile);
    const start = entries.find((entry): entry is Extract<JournalEntry, {op: "start"}> => entry.op === "start");
    if (!start) throw new Error(`${journalFile} has no start entry`);
    if (start.database !== db().databaseName) throw new Error(`${journalFile} was written against database ${start.database}, not ${db().databaseName}`);
    for (const entry of [...entries].reverse()) {
        if (entry.op === "insert") {
            const result = await raw(entry.collection).deleteMany({_id: {$in: entry.ids}});
            log(`  ${entry.collection}: removed ${result.deletedCount}`);
        } else if (entry.op === "update") {
            await raw(entry.collection).replaceOne({_id: entry.id}, entry.before);
            log(`  ${entry.collection} ${entry.id}: restored`);
        } else if (entry.op === "company") {
            await removeCompany(entry.id, log);
        }
    }
}

/** A recreated sub-company and everything it owns: its rows in every collection, its bot, its audit trail. */
async function removeCompany(companyId: ObjectId, log: Log): Promise<void> {
    const collections = await db().listCollections({type: "collection"}, {nameOnly: true}).toArray();
    let removed = 0;
    for (const {name} of collections) {
        if (name.startsWith("system.")) continue;
        const result = await raw(name).deleteMany({$or: [{company: companyId}, {organizationId: companyId}]});
        removed += result.deletedCount;
    }
    removed += (await raw("users").deleteMany({isBot: true, companies: [companyId]})).deletedCount;
    removed += (await raw("auditlogs").deleteMany({documentId: companyId})).deletedCount;
    const company = (await raw("companies").deleteMany({_id: companyId})).deletedCount;
    log(`  company ${companyId}: removed ${company === 1 ? "it" : "nothing (it was not created)"} and ${removed} rows it owned`);
}
