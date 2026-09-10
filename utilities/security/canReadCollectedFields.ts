import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {getModelCollectedData} from "@coreModule/database/collections";
import type {UserContext} from "@coreModule/utilities/types/types";

/** True when SchemaGuard allows at least one collected read field on the model. */
export function canReadCollectedFields(
    collectionName: string,
    actionUserCtx: UserContext,
    languageCode: string,
): boolean {
    const {model, readFields} = getModelCollectedData(collectionName);
    if (!model || !readFields) return false;
    try {
        SchemaGuard.sanitizeFields(model, readFields, "read", actionUserCtx, languageCode);
        return true;
    } catch {
        return false;
    }
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
