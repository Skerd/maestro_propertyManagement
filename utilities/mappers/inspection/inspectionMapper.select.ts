import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {IInspection} from "../../../database/schemas/inspection/inspection";

export function inspectionToSelect(inspection: IInspection): ApiSelectDatum {
    let label = inspection.name ?? "";

    if (inspection.unit) {
        const unit = inspection.unit as { unitNumber?: string; name?: string };
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

    if (!label) {
        label = inspection._id.toString();
    }

    return {
        value: inspection._id.toString(),
        label
    };
}

export function inspectionsToSelect(inspections: IInspection[]): ApiSelectDatum[] {
    return inspections.map((inspection) => inspectionToSelect(inspection));
}
