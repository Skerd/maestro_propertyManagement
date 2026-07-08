import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IUnitTypeCategory} from "../../../database/schemas/unitTypeCategory/unitTypeCategory";

export function unitTypeCategoryToSelect(unitTypeCategory: IUnitTypeCategory): ApiSelectDatum {
    return {
        value: unitTypeCategory._id.toString(),
        label: unitTypeCategory.name,
    };
}

export function unitTypeCategoriesToSelect(unitTypeCategories: IUnitTypeCategory[]): ApiSelectDatum[] {
    return unitTypeCategories.map(unitTypeCategoryToSelect);
}
