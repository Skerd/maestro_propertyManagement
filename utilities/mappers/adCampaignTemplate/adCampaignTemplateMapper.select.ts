import type {IAdCampaignTemplate} from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate";

export function adCampaignTemplatesToSelect(docs: IAdCampaignTemplate[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        // Locale-qualified: the picker shows every locale sibling, and they all
        // share a name, so the bare name would be ambiguous. A row read without
        // its locale shows the bare name, never "(undefined)" (TD-F78).
        label: doc.locale ? `${doc.name} (${doc.locale})` : doc.name,
    }));
}
