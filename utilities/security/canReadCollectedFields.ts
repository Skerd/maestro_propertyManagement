import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {SanitizedFields} from "armonia/src/modules/core/types";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {getModelCollectedData} from "@coreModule/database/collections";
import type {UserContext} from "@coreModule/utilities/types/types";

/** The read allowlist SchemaGuard grants the caller on the model's collected fields (`{}` when none). */
export function collectedReadFields(
    collectionName: string,
    actionUserCtx: UserContext,
    languageCode: string,
): SanitizedFields {
    const {model, readFields} = getModelCollectedData(collectionName);
    if (!model || !readFields) return {};
    try {
        return SchemaGuard.sanitizeFields(model, readFields, "read", actionUserCtx, languageCode);
    } catch {
        // sanitizeFields refuses an empty allowlist; for a hub that just means "nothing readable here".
        return {};
    }
}

/** True when SchemaGuard allows at least one collected read field on the model. */
export function canReadCollectedFields(
    collectionName: string,
    actionUserCtx: UserContext,
    languageCode: string,
): boolean {
    return Object.keys(collectedReadFields(collectionName, actionUserCtx, languageCode)).length > 0;
}

/**
 * True when the allowlist grants the dotted path (`installments.amount`). A granted field without nested
 * `keys` grants everything under it, the way SchemaGuard grants an embedded document with its parent.
 */
export function grantsPath(fields: SanitizedFields, path: string): boolean {
    let level: SanitizedFields | undefined = fields;
    for (const segment of path.split(".")) {
        if (!level) return true;
        const entry: {keys?: SanitizedFields} | undefined = level[segment];
        if (!entry) return false;
        level = entry.keys && Object.keys(entry.keys).length ? entry.keys : undefined;
    }
    return true;
}

/** `read(collection, path)`: field-level read checks for one request (SEC-09), one SchemaGuard pass per collection. */
export type CollectedFieldReader = (collectionName: string, path: string) => boolean;

export function collectedFieldReader(actionUserCtx: UserContext, languageCode: string): CollectedFieldReader {
    const cache = new Map<string, SanitizedFields>();
    return (collectionName, path) => {
        let fields = cache.get(collectionName);
        if (!fields) {
            fields = collectedReadFields(collectionName, actionUserCtx, languageCode);
            cache.set(collectionName, fields);
        }
        return grantsPath(fields, path);
    };
}

/** Keys of `Row` that may be absent, so dropping one keeps the row a valid `Row`. */
type OptionalKeys<Row> = {[K in keyof Row]-?: Record<string, never> extends Pick<Row, K> ? K : never}[keyof Row];

/** Where each optional row field comes from: `[collection, field path]`; every listed source must be readable. */
export type RowFieldSources<Row> = Partial<Record<OptionalKeys<Row>, readonly (readonly [string, string])[]>>;

/** The row keys the caller may not see, worked out once per request and reused for every row. */
export function unreadableRowKeys<Row>(sources: RowFieldSources<Row>, read: CollectedFieldReader): OptionalKeys<Row>[] {
    const hidden: OptionalKeys<Row>[] = [];
    for (const key of Object.keys(sources) as OptionalKeys<Row>[]) {
        const paths = sources[key];
        if (paths && !paths.every(([collectionName, path]) => read(collectionName, path))) hidden.push(key);
    }
    return hidden;
}

/** A copy of `row` without `keys`. */
export function omitRowKeys<Row extends object>(row: Row, keys: readonly OptionalKeys<Row>[]): Row {
    if (!keys.length) return row;
    const copy = {...row};
    for (const key of keys) delete copy[key];
    return copy;
}

/** Throws the same key CRUD list uses when the user cannot read any of the endpoint's models. */
export function assertAnyCollectedRead(
    allowed: boolean,
    languageCode: string,
): void {
    if (!allowed) {
        throw apiValidationException("schema_sanitizer_no_read_permission", "", null, languageCode);
    }
}
