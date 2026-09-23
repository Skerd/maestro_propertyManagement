import type {AdCampaignRecipient} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignRecipient/adCampaignRecipient.dto";
import type {IAdCampaignRecipient} from "../../../database/schemas/adCampaignRecipient/adCampaignRecipient";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

const iso = (d: Date | string | undefined | null) => (d instanceof Date ? d.toISOString() : d ?? undefined);

export function adCampaignRecipientToDTO(doc: IAdCampaignRecipient): AdCampaignRecipient {
    return {
        _id:            doc._id.toString(),
        campaign:       mapPopulatedRef(doc.campaign),
        campaignType:   doc.campaignType,
        audienceKind:   doc.audienceKind,
        user:           doc.user ? mapPopulatedRef(doc.user) : undefined,
        lead:           doc.lead ? mapPopulatedRef(doc.lead) : undefined,
        email:          doc.email,
        fullName:       doc.fullName ?? undefined,
        languageCode:   doc.languageCode ?? undefined,
        status:         doc.status,
        skipReason:     doc.skipReason ?? undefined,
        attempts:       doc.attempts ?? 0,
        sentAt:         iso(doc.sentAt),
        messageId:      doc.messageId ?? undefined,
        lastError:      doc.lastError ?? undefined,
        unsubscribedAt: iso(doc.unsubscribedAt),
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function adCampaignRecipientsToDTO(docs: IAdCampaignRecipient[]): AdCampaignRecipient[] {
    return docs.map(adCampaignRecipientToDTO);
}

export function adCampaignRecipientsToSelect(docs: IAdCampaignRecipient[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.fullName ? `${doc.fullName} <${doc.email}>` : doc.email,
    }));
}
