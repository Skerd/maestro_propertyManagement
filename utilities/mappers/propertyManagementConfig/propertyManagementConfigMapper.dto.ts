import type {PropertyManagementConfig} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/propertyManagementConfig.dto";
import type {IPropertyManagementConfig} from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function propertyManagementConfigToDTO(doc: IPropertyManagementConfig | any): PropertyManagementConfig {
    return {
        _id: doc._id.toString(),
        requiresSaleApproval: !!doc.requiresSaleApproval,
        requiresHandoverPackageForHandover: !!doc.requiresHandoverPackageForHandover,
        ...mapOwnershipToDTO(doc),
    };
}

export function propertyManagementConfigsToDTO(docs: IPropertyManagementConfig[]): PropertyManagementConfig[] {
    return docs.map(propertyManagementConfigToDTO);
}
