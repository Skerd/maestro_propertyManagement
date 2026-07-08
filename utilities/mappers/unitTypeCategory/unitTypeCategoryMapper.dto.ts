import {IUnitTypeCategory} from "../../../database/schemas/unitTypeCategory/unitTypeCategory";
import {UnitTypeCategory} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitTypeCategory/unitTypeCategory.dto";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function unitTypeCategoryToDTO(unitTypeCategory: IUnitTypeCategory): UnitTypeCategory {
    return {
        _id: unitTypeCategory._id.toString(),
        name: unitTypeCategory.name,
        ...mapSoftDeleteToDTO(unitTypeCategory),
        ...mapOwnershipToDTO(unitTypeCategory),
        ...mapLifeCycleToDTO(unitTypeCategory),
    };
}

export function unitTypeCategoriesToDTO(unitTypeCategories: IUnitTypeCategory[]): UnitTypeCategory[] {
    return unitTypeCategories.map(unitTypeCategoryToDTO);
}
