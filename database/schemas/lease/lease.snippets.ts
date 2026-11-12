import type {LeaseSimple} from "armonia/src/modules/propertyManagement/dto/lease.dto";
import type {ILease} from "@propertyManagement/database/schemas/lease/lease";
import {defineSnippet} from "@coreModule/database/utilities/snippet";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";

export const LeaseSimpleSnippet = defineSnippet<ILease, LeaseSimple>()({
    keys: {
        _id: {},
        name: {},
        status: {},
        tenant: SimpleBlankUserSnippet,
    },
});
