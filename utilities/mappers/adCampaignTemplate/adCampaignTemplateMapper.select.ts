import type {IAdCampaignTemplate} from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate";

export function adCampaignTemplatesToSelect(docs: IAdCampaignTemplate[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        // Locale-qualified: the picker shows every locale sibling, and they all
        // share a name, so the bare name would be ambiguous.
        label: `${doc.name} (${doc.locale})`,
    }));
}
