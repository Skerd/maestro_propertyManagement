import type {InspectionSimple} from "armonia/src/modules/propertyManagement/dto/inspection.dto";
import type {IInspection} from "@propertyManagement/database/schemas/inspection/inspection";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const InspectionSimpleSnippet = defineSnippet<IInspection, InspectionSimple>()({
    keys: {
        _id: {},
        name: {},
    },
});
