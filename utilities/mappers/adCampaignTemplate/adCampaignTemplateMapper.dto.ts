import type {AdCampaignTemplate} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/adCampaignTemplate.dto";
import type {IAdCampaignTemplate} from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function adCampaignTemplateToDTO(doc: IAdCampaignTemplate): AdCampaignTemplate {
    return {
        _id:          doc._id.toString(),
        name:         doc.name,
        campaignType: doc.campaignType,
        locale:       doc.locale,
        subject:      doc.subject,
        previewText:  doc.previewText ?? undefined,
        bodyHtml:     doc.bodyHtml,
        isDefault:    doc.isDefault ?? undefined,
        active:       doc.active ?? undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function adCampaignTemplatesToDTO(docs: IAdCampaignTemplate[]): AdCampaignTemplate[] {
    return docs.map(adCampaignTemplateToDTO);
}
