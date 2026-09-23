import type {IAdCampaign} from "../../../database/schemas/adCampaign/adCampaign";

export function adCampaignsToSelect(docs: IAdCampaign[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
