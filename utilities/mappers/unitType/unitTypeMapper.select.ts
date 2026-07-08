import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IUnitType} from "../../../database/schemas/unitType/unitType";

export function unitTypeToSelect(unitType: Pick<IUnitType, "_id" | "name">): ApiSelectDatum {
    return {
        value: unitType._id.toString(),
        label: unitType.name,
    };
}

export function unitTypesToSelect(unitTypes: Pick<IUnitType, "_id" | "name">[]): ApiSelectDatum[] {
    return unitTypes.map(unitTypeToSelect);
}

/** Map `$group: { _id: "$field" }` rows to `{ value, label }` (unique field values). */
export function distinctFieldValuesToSelect(rows: {_id: unknown}[]): ApiSelectDatum[] {
    return rows.map((row) => {
        const label = row._id == null || row._id === undefined ? "" : String(row._id);
        return {value: label, label};
    });
}
