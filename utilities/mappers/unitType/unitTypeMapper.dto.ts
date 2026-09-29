import {IUnitType} from "../../../database/schemas/unitType/unitType";
import {UnitType} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitType/unitType.dto";
import type {UnitTypeCategorySimple} from "armonia/src/modules/propertyManagement/dto/unitTypeCategory.dto";
import {UnitTypeCategorySimpleSnippet} from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory.snippets";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";

export function unitTypeToDTO(unitType: IUnitType): UnitType {
    return {
        _id: unitType._id.toString(),
        name: unitType.name,
        slug: unitType.slug,
        category: mapSnippet<UnitTypeCategorySimple>()(unitType.category, UnitTypeCategorySimpleSnippet),
        description: unitType.description,
        icon: unitType.icon,
        group: unitType.group,
        isPrivate: unitType.isPrivate,
        ...mapSoftDeleteToDTO(unitType),
        ...mapOwnershipToDTO(unitType),
        ...mapLifeCycleToDTO(unitType)
    };
}

export function unitTypesToDTO(unitTypes: IUnitType[]): UnitType[] {
    const out: UnitType[] = [];
    for (const unitType of unitTypes) {
        out.push(unitTypeToDTO(unitType));
    }
    return out;
}
