import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {AdCampaignTemplateSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/adCampaignTemplate.schema-def";
import {createAdCampaignTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/createAdCampaignTemplate.form.validator";
import {editAdCampaignTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/editAdCampaignTemplate.form.validator";
import {validateTableForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import AdCampaignTemplate from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate";
import {adCampaignTemplateService} from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate.service";
import {AdCampaignTemplateActions} from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate.actions";
import {
    adCampaignTemplateToDTO,
    adCampaignTemplatesToDTO,
} from "../../../utilities/mappers/adCampaignTemplate/adCampaignTemplateMapper.dto";
import {adCampaignTemplatesToSelect} from "../../../utilities/mappers/adCampaignTemplate/adCampaignTemplateMapper.select";
import {sanitizeAdCampaignHtml} from "../../../utilities/emails/adCampaignHtmlSanitizer";

export const {router} = createCrudRouter({
    collectionName: "adcampaigntemplates",
    model:          AdCampaignTemplate,
    service:        adCampaignTemplateService,
    entityName:     "AdCampaignTemplate",
    actions:        AdCampaignTemplateActions,
    listSchema:     validateTableForm,
    createSchema:   createAdCampaignTemplateFormSchema,
    editSchema:     editAdCampaignTemplateFormSchema,
    toDTO:          adCampaignTemplateToDTO,
    toDTOArray:     adCampaignTemplatesToDTO,
    toSelect:       adCampaignTemplatesToSelect,
    defaultSort:    {name: 1, locale: 1},
    selectSort:     {name: 1, locale: 1},
    selectSearchField: "name",
    // Sanitize on write so the stored row is never unsafe. The renderer
    // sanitizes again — that second pass covers rows written before this
    // existed, or by any future import path that bypasses this router.
    buildCreateData: (params: any) => {
        const data = buildCreateDataFromSchemaDef(AdCampaignTemplateSchemaDef)(params);
        if (typeof data.bodyHtml === "string") data.bodyHtml = sanitizeAdCampaignHtml(data.bodyHtml);
        return data;
    },
    buildUpdateData: (params: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(AdCampaignTemplateSchemaDef)(params, writeFields);
        if (typeof data.bodyHtml === "string") data.bodyHtml = sanitizeAdCampaignHtml(data.bodyHtml);
        return data;
    },
});
