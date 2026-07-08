import {ILead} from "../../../database/schemas/lead/lead";
import {Lead, LeadActivityEntry} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.dto";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {
    decimal128ToNumber,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";

function mapActivityEntry(entry: any): LeadActivityEntry {
    return {
        _id:         entry._id?.toString() ?? "",
        action:      entry.action,
        notes:       entry.notes || undefined,
        performedBy: entry.performedBy ? mapPopulatedSimpleUser(entry.performedBy) : undefined,
        performedAt: entry.performedAt ? new Date(entry.performedAt).toISOString() : new Date().toISOString(),
    };
}

export function leadToDTO(lead: ILead): Lead {
    const projectInterest = lead.projectInterest as any;
    const unitInterest    = lead.unitInterest as any;

    return {
        _id:       lead._id.toString(),
        name:      lead.name,
        firstName: lead.firstName,
        lastName:  lead.lastName,
        email:     lead.email,
        phone:     lead.phone,
        status:    lead.status,
        source:    lead.source,
        projectInterest: mapPopulatedRef(projectInterest),
        unitInterest: unitInterest ? {
            _id:        unitInterest._id?.toString() ?? unitInterest.toString(),
            name:       unitInterest.name,
            unitNumber: unitInterest.unitNumber,
        } : undefined,
        budget:         decimal128ToNumber(lead.budget),
        budgetCurrency: mapPopulatedSimpleCurrency(lead.budgetCurrency as any),
        notes:          lead.notes,
        assignedTo:     mapPopulatedSimpleUser(lead.assignedTo),
        followUpDate:   lead.followUpDate ? new Date(lead.followUpDate).toISOString().split("T")[0] : undefined,
        convertedAt:    lead.convertedAt  ? new Date(lead.convertedAt).toISOString()  : undefined,
        activityLog:    Array.isArray(lead.activityLog) && lead.activityLog.length > 0 ? lead.activityLog.map(mapActivityEntry) : undefined,
        ...mapSoftDeleteToDTO(lead),
        ...mapOwnershipToDTO(lead),
        ...mapLifeCycleToDTO(lead)
    };
}

export function leadsToDTO(leads: ILead[]): Lead[] {
    return leads.map(leadToDTO);
}
