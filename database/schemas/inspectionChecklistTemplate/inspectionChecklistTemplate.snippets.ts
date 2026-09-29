import type {InspectionChecklistTemplateSimple} from "armonia/src/modules/propertyManagement/dto/inspectionChecklistTemplate.dto";
import type {IInspectionChecklistTemplate} from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const InspectionChecklistTemplateSimpleSnippet = defineSnippet<IInspectionChecklistTemplate, InspectionChecklistTemplateSimple>()({
    keys: {
        _id: {},
        name: {},
        title: {},
    },
});
