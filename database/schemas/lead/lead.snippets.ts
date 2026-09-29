import type {LeadSimple} from "armonia/src/modules/propertyManagement/dto/lead.dto";
import type {ILead} from "@propertyManagement/database/schemas/lead/lead";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const LeadSimpleSnippet = defineSnippet<ILead, LeadSimple>()({
    keys: {
        _id: {},
        name: {},
        firstName: {},
        lastName: {},
        status: {},
    },
});
