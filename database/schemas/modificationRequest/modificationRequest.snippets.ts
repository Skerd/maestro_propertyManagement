import type {ModificationRequestSimple} from "armonia/src/modules/propertyManagement/dto/modificationRequest.dto";
import type {IModificationRequest} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const ModificationRequestSimpleSnippet = defineSnippet<IModificationRequest, ModificationRequestSimple>()({
    keys: {
        _id: {},
        name: {},
        // What linked records (unit cost, PD variation order) show instead of the code (UX-03).
        title: {},
    },
});
