import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {IFloor} from "@propertyManagement/database/schemas/floor/floor";
import {defineSnippet} from "@coreModule/database/utilities/snippet";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";

export const FloorSimpleSnippet = defineSnippet<IFloor, FloorSimple>()({
    keys: {
        _id: {},
        name: {},
        edifice: EdificeSimpleSnippet,
    },
});
