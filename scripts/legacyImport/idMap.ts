/**
 * Old id → new id for the legacy import (D171). One map covers every kind of remap: the old company to the target,
 * per-company list rows to platform rows (D160), old roles and permissions to the current ones, merged users to their
 * existing accounts, and records whose `_id` another company's record already holds. Applying it is a deep walk, so no
 * reference path has to be listed by hand and none can be missed.
 */
import {ObjectId} from "mongodb";

/** A whole 24-digit hex token: never part of a longer hex run such as an encrypted message or a password hash. */
const HEX_ID_ANYWHERE = /(?<![0-9a-fA-F])[0-9a-f]{24}(?![0-9a-fA-F])/g;

/** A JSON-like object as BSON decodes one (not an ObjectId, Date, Decimal128 or other BSON value). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export class IdMap {
    private readonly ids = new Map<string, ObjectId>();

    set(oldId: ObjectId | string, newId: ObjectId): void {
        const key = String(oldId);
        if (key === newId.toHexString()) {
            this.ids.delete(key);
            return;
        }
        this.ids.set(key, newId);
    }

    get(oldId: ObjectId | string): ObjectId | undefined {
        return this.ids.get(String(oldId));
    }

    has(oldId: ObjectId | string): boolean {
        return this.ids.has(String(oldId));
    }

    /** The id `oldId` becomes: its mapped id, else itself. */
    resolve(oldId: ObjectId): ObjectId {
        return this.ids.get(oldId.toHexString()) ?? oldId;
    }

    get size(): number {
        return this.ids.size;
    }

    entries(): IterableIterator<[string, ObjectId]> {
        return this.ids.entries();
    }

    /**
     * A deep copy of `value`: every mapped ObjectId is replaced, and so is a mapped id written inside a string (ids a
     * notification's `content` or a GridFS file's metadata stores as text, a media link in a story). Dates, Decimal128
     * and other BSON values are immutable and shared.
     */
    remap<T>(value: T): T {
        return this.remapValue(value) as T;
    }

    private remapValue(value: unknown): unknown {
        if (value instanceof ObjectId) return this.resolve(value);
        if (typeof value === "string") {
            if (this.ids.size === 0 || value.length < 24) return value;
            return value.replace(HEX_ID_ANYWHERE, (hex) => this.ids.get(hex)?.toHexString() ?? hex);
        }
        if (Array.isArray(value)) return value.map((item) => this.remapValue(item));
        if (isPlainObject(value)) {
            const copy: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) copy[key] = this.remapValue(item);
            return copy;
        }
        return value;
    }
}

export interface ObjectIdReference {
    path: string;
    id: ObjectId;
}

/**
 * Every ObjectId a document points at, with its path. `_id` keys are skipped (the document's own id and its
 * embedded rows' ids are not references), as are the paths in `skipPaths` and below them.
 */
export function collectReferences(document: Record<string, unknown>, skipPaths: readonly string[] = []): ObjectIdReference[] {
    const found: ObjectIdReference[] = [];
    const walk = (value: unknown, path: string): void => {
        if (skipPaths.includes(path)) return;
        if (value instanceof ObjectId) {
            found.push({path, id: value});
        } else if (Array.isArray(value)) {
            for (const item of value) walk(item, `${path}[]`);
        } else if (isPlainObject(value)) {
            for (const [key, item] of Object.entries(value)) {
                if (key === "_id") continue;
                walk(item, path ? `${path}.${key}` : key);
            }
        }
    };
    walk(document, "");
    return found;
}
