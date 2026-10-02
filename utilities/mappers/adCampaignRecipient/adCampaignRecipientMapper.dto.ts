import type {AdCampaignRecipient} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignRecipient/adCampaignRecipient.dto";
import type {IAdCampaignRecipient} from "../../../database/schemas/adCampaignRecipient/adCampaignRecipient";
import type {SimpleUser} from "armonia/src/modules/core/dto/user.dto";
import type {AdCampaignSimple} from "armonia/src/modules/propertyManagement/dto/adCampaign.dto";
import type {LeadSimple} from "armonia/src/modules/propertyManagement/dto/lead.dto";
import {SimpleUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {AdCampaignSimpleSnippet} from "@propertyManagement/database/schemas/adCampaign/adCampaign.snippets";
import {LeadSimpleSnippet} from "@propertyManagement/database/schemas/lead/lead.snippets";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function adCampaignRecipientToDTO(doc: IAdCampaignRecipient): AdCampaignRecipient {
    return {
        _id:            doc._id.toString(),
        campaign:       mapSnippet<AdCampaignSimple>()(doc.campaign, AdCampaignSimpleSnippet)!,
        campaignType:   doc.campaignType,
        audienceKind:   doc.audienceKind,
        user:           mapSnippet<SimpleUser>()(doc.user, SimpleUserSnippet),
        lead:           mapSnippet<LeadSimple>()(doc.lead, LeadSimpleSnippet),
        email:          doc.email,
        firstName:      doc.firstName ?? undefined,
        lastName:       doc.lastName ?? undefined,
        fullName:       doc.fullName ?? undefined,
        languageCode:   doc.languageCode ?? undefined,
        status:         doc.status,
        skipReason:     doc.skipReason ?? undefined,
        attempts:       doc.attempts ?? 0,
        sentAt:         doc.sentAt ?? undefined,
        messageId:      doc.messageId ?? undefined,
        lastError:      doc.lastError ?? undefined,
        unsubscribedAt: doc.unsubscribedAt ?? undefined,
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
