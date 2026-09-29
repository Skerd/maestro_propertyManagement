import type {UnitTypeCategorySimple} from "armonia/src/modules/propertyManagement/dto/unitTypeCategory.dto";
import type {IUnitTypeCategory} from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const UnitTypeCategorySimpleSnippet = defineSnippet<IUnitTypeCategory, UnitTypeCategorySimple>()({
    keys: {
        _id: {},
        name: {},
    },
});
