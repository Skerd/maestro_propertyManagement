import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {IModificationRequest} from "../../../database/schemas/modificationRequest/modificationRequest";

export function modificationRequestToSelect(modificationRequest: IModificationRequest): ApiSelectDatum {
    let label = "";
    if (modificationRequest.name) {
        label = modificationRequest.name;
    }
    if (modificationRequest.unit) {
        const unit = modificationRequest.unit;
        let unitLabel = "";
        if (unit.unitNumber) {
            unitLabel = unit.unitNumber;
        }
        if (unit.name && unitLabel) {
            unitLabel += ` - ${unit.name}`;
        } else if (unit.name) {
            unitLabel = unit.name;
        }
        if (unitLabel) {
            label = label ? `${label} [${unitLabel}]` : unitLabel;
        }
    }
    if (modificationRequest.status && label) {
        label = `${label} (${modificationRequest.status})`;
    }
    else if (modificationRequest.status && !label) {
        label = String(modificationRequest.status);
    }
    if (!label) {
        label = modificationRequest._id.toString();
    }
    return {
        value: modificationRequest._id.toString(),
        label
    };
}

export function modificationRequestsToSelect(modificationRequests: IModificationRequest[]): ApiSelectDatum[] {
    return modificationRequests.map(modificationRequestToSelect);
}