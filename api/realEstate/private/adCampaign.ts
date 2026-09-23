import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {AdCampaignSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.schema-def";
import {createAdCampaignFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/createAdCampaign.form.validator";
import {editAdCampaignFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/editAdCampaign.form.validator";
import {validateTableForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import AdCampaign from "../../../database/schemas/adCampaign/adCampaign";
import {adCampaignService} from "../../../database/schemas/adCampaign/adCampaign.service";
import {AdCampaignActions} from "../../../database/schemas/adCampaign/adCampaign.actions";
import {adCampaignToDTO, adCampaignsToDTO} from "../../../utilities/mappers/adCampaign/adCampaignMapper.dto";
import {adCampaignsToSelect} from "../../../utilities/mappers/adCampaign/adCampaignMapper.select";
import {sanitizeAdCampaignHtml} from "../../../utilities/emails/adCampaignHtmlSanitizer";

const optionalDateTransform = (v: unknown) => (v ? new Date(v as string) : undefined);

/**
 * A campaign that is already sending must not have its audience or content
 * edited underneath the drain — half the recipients would get one message and
 * half another, with no record of which got what.
 */
async function assertEditable(params: any): Promise<void> {
    const current = await AdCampaign.findOne({_id: params._id, company: params.company._id})
        .select("status")
        .session(params.session ?? null);
    if (!current) return;
    if (!adCampaignService.isEditable(current.status)) {
        throw apiValidationException("ad_campaign_not_editable", "status", null, params.languageCode);
    }
}

export const {router} = createCrudRouter({
    collectionName: "adcampaigns",
    model:          AdCampaign,
    service:        adCampaignService,
    entityName:     "AdCampaign",
    actions:        AdCampaignActions,
    listSchema:     validateTableForm,
    createSchema:   createAdCampaignFormSchema,
    editSchema:     editAdCampaignFormSchema,
    toDTO:          adCampaignToDTO,
    toDTOArray:     adCampaignsToDTO,
    toSelect:       adCampaignsToSelect,
    defaultSort:    {createdAt: -1},
    selectSort:     {createdAt: -1},
    selectSearchField: "title",
    // Same write-time sanitization as the template's `bodyHtml`; see that
    // router for why it is applied on write as well as on render.
    buildCreateData: (params: any) => {
        const data = buildCreateDataFromSchemaDef(AdCampaignSchemaDef, {
            scheduledAt: optionalDateTransform,
        })(params);
        if (typeof data.bodyHtmlOverride === "string") {
            data.bodyHtmlOverride = sanitizeAdCampaignHtml(data.bodyHtmlOverride);
        }
        return data;
    },
    buildUpdateData: async (params: any, writeFields) => {
        await assertEditable(params);
        const data = buildUpdateDataFromSchemaDef(AdCampaignSchemaDef, {
            scheduledAt: optionalDateTransform,
        })(params, writeFields);
        if (typeof data.bodyHtmlOverride === "string") {
            data.bodyHtmlOverride = sanitizeAdCampaignHtml(data.bodyHtmlOverride);
        }
        return data;
    },
});
