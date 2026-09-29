import type {ConstructorSimple} from "armonia/src/modules/propertyManagement/dto/constructor.dto";
import type {IConstructor} from "@propertyManagement/database/schemas/constructor/constructor";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const ConstructorSimpleSnippet = defineSnippet<IConstructor, ConstructorSimple>()({
    keys: {
        _id: {},
        name: {},
    },
});
