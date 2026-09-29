import {ILead} from "../../../database/schemas/lead/lead";
import {Lead, LeadActivityEntry} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ChannelLeadChatSnippet} from "@coreModule/database/schemas/channel/channel.snippets";
import type {ChannelLeadChat} from "armonia/src/modules/core/dto/channel.dto";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {
    decimalToNumber,
    mapSnippet,
} from "@coreModule/utilities/mappers/common.mapper";

function mapActivityEntry(entry: {
    _id?: {toString(): string};
    action: string;
    notes?: string;
    performedBy?: object;
    performedAt?: Date | string;
}): LeadActivityEntry {
    return {
        _id:         entry._id?.toString() ?? "",
        action:      entry.action,
        notes:       entry.notes || undefined,
        performedBy: mapSnippet<SimpleBlankUser>()(entry.performedBy, SimpleBlankUserSnippet),
        performedAt: entry.performedAt ? new Date(entry.performedAt).toISOString() : new Date().toISOString(),
    };
}

export function leadToDTO(lead: ILead): Lead {
    const chat = mapSnippet<ChannelLeadChat>()(lead.chat, ChannelLeadChatSnippet);

    return {
        _id:       lead._id.toString(),
        name:      lead.name,
        firstName: lead.firstName,
        lastName:  lead.lastName,
        email:     lead.email,
        phone:     lead.phone,
        status:    lead.status,
        source:    lead.source,
        interest:  lead.interest,
        projectInterest: mapSnippet<ProjectSimple>()(lead.projectInterest, ProjectSimpleSnippet),
        unitInterest: mapSnippet<UnitSimple>()(lead.unitInterest, UnitSimpleSnippet),
        budget:         decimalToNumber(lead.budget),
        budgetCurrency: mapSnippet<CurrencySimple>()(lead.budgetCurrency, CurrencySimpleSnippet),
        notes:          lead.notes,
        chat: chat
            ? {
                _id: chat._id,
                name: chat.publicChat?.visitor?.displayName || chat.name || undefined,
            }
            : undefined,
        assignedTo:     mapSnippet<SimpleBlankUser>()(lead.assignedTo, SimpleBlankUserSnippet),
        followUpDate:   lead.followUpDate ? new Date(lead.followUpDate).toISOString().split("T")[0] : undefined,
        convertedAt:    lead.convertedAt  ? new Date(lead.convertedAt).toISOString()  : undefined,
        lostReason:     lead.lostReason,
        activityLog:    Array.isArray(lead.activityLog) && lead.activityLog.length > 0 ? lead.activityLog.map(mapActivityEntry) : undefined,
        ...mapSoftDeleteToDTO(lead),
        ...mapOwnershipToDTO(lead),
        ...mapLifeCycleToDTO(lead)
    };
}

export function leadsToDTO(leads: ILead[]): Lead[] {
    return leads.map(leadToDTO);
}
