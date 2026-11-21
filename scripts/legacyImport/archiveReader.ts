/**
 * Streaming reader for a `mongodump --archive` file, gzipped or not (D171).
 *
 * The format (mongo-tools `archive` package): a little-endian magic number, a prelude (one header document, then one
 * metadata document per collection, then a terminator), then the body: namespace headers, each followed by that
 * namespace's documents and a terminator. Collections are interleaved, and a namespace header with `EOF: true` closes
 * a collection. A terminator is the 32-bit integer -1 where a document's size would be.
 *
 * Reading it directly means an import needs no staging database and no mongorestore of a matching version. Memory
 * stays flat: each document is handed to the visitor as raw BSON and nothing is kept. zlib checks the gzip CRC, and a
 * file that ends mid-document or mid-collection is refused.
 */
import {createReadStream} from "node:fs";
import {createGunzip} from "node:zlib";
import type {Readable} from "node:stream";
import * as mongodb from "mongodb";
import type {Document} from "mongodb";

/** The part of the driver's BSON codec the import uses. */
interface BsonCodec {
    deserialize(buffer: Buffer, options?: {promoteBuffers?: boolean}): Document;
    serialize(document: Document): Uint8Array;
    EJSON: {
        stringify(value: unknown, options?: {relaxed?: boolean}): string;
        parse(text: string, options?: {relaxed?: boolean}): unknown;
    };
}

function isBsonCodec(value: unknown): value is BsonCodec {
    if (value === null || typeof value !== "object") return false;
    const ejson: unknown = Reflect.get(value, "EJSON");
    return typeof Reflect.get(value, "deserialize") === "function" && typeof Reflect.get(value, "serialize") === "function"
        && ejson !== null && typeof ejson === "object"
        && typeof Reflect.get(ejson, "stringify") === "function" && typeof Reflect.get(ejson, "parse") === "function";
}

const driverBson: unknown = Reflect.get(mongodb, "BSON");
if (!isBsonCodec(driverBson)) throw new Error("The mongodb driver no longer exports its BSON codec");
/**
 * The driver's own BSON codec: mongodb 4 exports it at runtime but leaves it out of its typings, and using it keeps
 * the import on the exact codec (and ObjectId/Decimal128 classes) Mongoose writes with, without a new dependency.
 */
export const BSON: BsonCodec = driverBson;

const ARCHIVE_MAGIC = 0x8199e26d;
const TERMINATOR = -1;
const READ_CHUNK_BYTES = 4 << 20;

export interface ArchiveCollection {
    db: string;
    collection: string;
    /** "collection", "timeseries" or "view". */
    type: string;
}

export interface ArchiveSummary {
    serverVersion: string;
    toolVersion: string;
    /** The collections the prelude lists, empty ones included. */
    collections: ArchiveCollection[];
    /** Documents read per namespace, as the body names it (a time series is `system.buckets.<name>`). */
    counts: Map<string, number>;
}

/** Gets every document of the body, in archive order. Awaited, so a slow visitor (a database write) slows the read. */
export type ArchiveVisitor = (collection: string, raw: Buffer) => void | Promise<void>;

type Stage = "magic" | "preludeHeader" | "prelude" | "namespace" | "documents";

function openArchive(filePath: string): Readable {
    const file = createReadStream(filePath, {highWaterMark: READ_CHUNK_BYTES});
    if (!filePath.endsWith(".gz")) return file;
    const gunzip = createGunzip({chunkSize: READ_CHUNK_BYTES});
    file.on("error", (error) => gunzip.destroy(error));
    return file.pipe(gunzip);
}

/** Reads the whole archive, handing each body document to `visit`. */
export async function readArchive(filePath: string, visit: ArchiveVisitor): Promise<ArchiveSummary> {
    const summary: ArchiveSummary = {serverVersion: "", toolVersion: "", collections: [], counts: new Map()};
    let stage: Stage = "magic";
    let namespace = "";
    let pending: Buffer = Buffer.alloc(0);

    for await (const chunk of openArchive(filePath) as AsyncIterable<Buffer>) {
        pending = pending.length > 0 ? Buffer.concat([pending, chunk]) : chunk;
        let offset = 0;
        for (;;) {
            if (pending.length - offset < 4) break;
            if (stage === "magic") {
                const magic = pending.readUInt32LE(offset);
                if (magic !== ARCHIVE_MAGIC) {
                    throw new Error(`${filePath} is not a mongodump archive (magic ${magic.toString(16)})`);
                }
                offset += 4;
                stage = "preludeHeader";
                continue;
            }
            const size = pending.readInt32LE(offset);
            if (size === TERMINATOR) {
                if (stage === "preludeHeader") throw new Error(`${filePath}: the archive prelude has no header`);
                offset += 4;
                stage = "namespace";
                continue;
            }
            if (size < 5) throw new Error(`${filePath}: corrupt archive (a document of ${size} bytes)`);
            if (pending.length - offset < size) break;
            const raw = pending.subarray(offset, offset + size);
            offset += size;

            if (stage === "preludeHeader") {
                const header = BSON.deserialize(raw);
                summary.serverVersion = String(header.server_version ?? "");
                summary.toolVersion = String(header.tool_version ?? "");
                stage = "prelude";
            } else if (stage === "prelude") {
                const metadata = BSON.deserialize(raw);
                summary.collections.push({db: String(metadata.db), collection: String(metadata.collection), type: String(metadata.type ?? "collection")});
            } else if (stage === "namespace") {
                const header = BSON.deserialize(raw);
                namespace = String(header.collection);
                stage = header.EOF === true ? "namespace" : "documents";
            } else {
                summary.counts.set(namespace, (summary.counts.get(namespace) ?? 0) + 1);
                await visit(namespace, raw);
            }
        }
        pending = pending.subarray(offset);
    }

    if (stage !== "namespace" || pending.length > 0) {
        throw new Error(`${filePath} ends early: the archive is truncated`);
    }
    return summary;
}

/**
 * The `_id` of a raw document without decoding it, when `_id` is its first field and an ObjectId (as mongod stores
 * every document here); undefined otherwise. Used to index the ids of collections that are skipped, not imported.
 */
export function rawObjectIdHex(raw: Buffer): string | undefined {
    // int32 size, then element type 0x07 (ObjectId), the key "_id\0", and 12 bytes.
    if (raw.length < 21 || raw[4] !== 0x07 || raw[5] !== 0x5f || raw[6] !== 0x69 || raw[7] !== 0x64 || raw[8] !== 0x00) return undefined;
    return raw.subarray(9, 21).toString("hex");
}
