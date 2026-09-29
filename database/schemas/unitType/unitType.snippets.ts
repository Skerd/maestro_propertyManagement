import type {UnitTypeSimple} from "armonia/src/modules/propertyManagement/dto/unitType.dto";
import type {IUnitType} from "@propertyManagement/database/schemas/unitType/unitType";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const UnitTypeSimpleSnippet = defineSnippet<IUnitType, UnitTypeSimple>()({
    keys: {
        _id: {},
        name: {},
        icon: {},
    },
});
