import type {PropertyManagementConfigSimple} from "armonia/src/modules/propertyManagement/dto/propertyManagementConfig.dto";
import type {IPropertyManagementConfig} from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const PropertyManagementConfigSimpleSnippet = defineSnippet<IPropertyManagementConfig, PropertyManagementConfigSimple>()({
    keys: {
        _id: {},
        requiresSaleApproval: {},
        requiresHandoverPackageForHandover: {},
        notifyOnSales: {},
        notifyOnReservations: {},
    },
});
