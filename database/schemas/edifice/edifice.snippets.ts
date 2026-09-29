import type {EdificeBlank, EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {IEdifice} from "@propertyManagement/database/schemas/edifice/edifice";
import {defineSnippet} from "@coreModule/database/utilities/snippet";
import {ProjectSimpleSnippet} from "../project/project.snippets";

export const EdificeSimpleSnippet = defineSnippet<IEdifice, EdificeSimple>()({
    keys: {
        _id: {},
        name: {},
        project: ProjectSimpleSnippet,
    },
});

export const EdificeSnippet = defineSnippet<IEdifice, EdificeBlank>()({
    keys: {
        _id: {},
        name: {},
    },
});
