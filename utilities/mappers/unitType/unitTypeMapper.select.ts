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
