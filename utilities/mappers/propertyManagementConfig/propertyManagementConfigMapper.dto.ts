import type {PropertyManagementConfig} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/propertyManagementConfig.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {IPropertyManagementConfig} from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";

function mapNotifyUsers(refs: unknown): SimpleBlankUser[] {
    if (!Array.isArray(refs)) return [];
    return refs
        .map((ref) => mapSnippet<SimpleBlankUser>()(ref as object | undefined, SimpleBlankUserSnippet))
        .filter((u): u is SimpleBlankUser => u != null);
}

export function propertyManagementConfigToDTO(doc: IPropertyManagementConfig): PropertyManagementConfig {
    return {
        _id: doc._id.toString(),
        requiresSaleApproval: !!doc.requiresSaleApproval,
        requiresHandoverPackageForHandover: !!doc.requiresHandoverPackageForHandover,
        listedOnPortal: !!doc.listedOnPortal,
        notifyOnSales: mapNotifyUsers(doc.notifyOnSales),
        notifyOnReservations: mapNotifyUsers(doc.notifyOnReservations),
        ...mapOwnershipToDTO(doc),
    };
}

export function propertyManagementConfigsToDTO(docs: IPropertyManagementConfig[]): PropertyManagementConfig[] {
    return docs.map(propertyManagementConfigToDTO);
}
