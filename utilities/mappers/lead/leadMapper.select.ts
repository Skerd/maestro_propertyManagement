import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {ILead} from "../../../database/schemas/lead/lead";

export function leadToSelect(lead: ILead): ApiSelectDatum {
    const nameParts = [lead.firstName, (lead as any).lastName].filter(Boolean);
    const label     = nameParts.length > 0 ? nameParts.join(" ") : (lead.name ?? lead._id.toString());
    return {
        value: lead._id.toString(),
        label,
    };
}

export function leadsToSelect(leads: ILead[]): ApiSelectDatum[] {
    return leads.map(leadToSelect);
}
