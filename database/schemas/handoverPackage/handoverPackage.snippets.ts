import type {HandoverPackageSimple} from "armonia/src/modules/propertyManagement/dto/handoverPackage.dto";
import type {IHandoverPackage} from "@propertyManagement/database/schemas/handoverPackage/handoverPackage";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const HandoverPackageSimpleSnippet = defineSnippet<IHandoverPackage, HandoverPackageSimple>()({
    keys: {
        _id: {},
        name: {},
        title: {},
    },
});
