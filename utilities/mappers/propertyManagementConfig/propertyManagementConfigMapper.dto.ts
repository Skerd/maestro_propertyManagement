import type {PropertyManagementConfig, PropertyManagementConfigNotifyUser} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/propertyManagementConfig.dto";
import type {IPropertyManagementConfig} from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";

function mapNotifyUsers(refs: unknown): PropertyManagementConfigNotifyUser[] {
    if (!Array.isArray(refs)) return [];
    return refs
        .map(ref => mapPopulatedSimpleUser(ref as any))
        .filter((u): u is NonNullable<typeof u> => !!u);
}

export function propertyManagementConfigToDTO(doc: IPropertyManagementConfig | any): PropertyManagementConfig {
    return {
        _id: doc._id.toString(),
        requiresSaleApproval: !!doc.requiresSaleApproval,
        requiresHandoverPackageForHandover: !!doc.requiresHandoverPackageForHandover,
        notifyOnSales: mapNotifyUsers(doc.notifyOnSales),
        notifyOnReservations: mapNotifyUsers(doc.notifyOnReservations),
        ...mapOwnershipToDTO(doc),
    };
}

export function propertyManagementConfigsToDTO(docs: IPropertyManagementConfig[]): PropertyManagementConfig[] {
    return docs.map(propertyManagementConfigToDTO);
}
