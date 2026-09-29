import type {ProjectSimple, ProjectWithImage} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {IProject} from "@propertyManagement/database/schemas/project/project";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const ProjectSimpleSnippet = defineSnippet<IProject, ProjectSimple>()({
    keys: {
        _id: {},
        name: {},
    },
});

export const ProjectWithImageSnippet = defineSnippet<IProject, ProjectWithImage>()({
    keys: {
        _id: {},
        name: {},
        mainImage: {},
    },
});
