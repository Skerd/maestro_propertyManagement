import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields,
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {AdCampaignTemplateSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignTemplate/adCampaignTemplate.schema-def";
import {
    AD_CAMPAIGN_BODY_MAX,
    AD_CAMPAIGN_LOCALE_VALUES,
    AD_CAMPAIGN_NAME_MAX,
    AD_CAMPAIGN_SUBJECT_MAX,
    AD_CAMPAIGN_TYPE_VALUES,
    type AdCampaignLocale,
    type AdCampaignType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {adCampaignTemplateViews} from "./adCampaignTemplate.views";
import {applyAdCampaignTemplateIndexes} from "./adCampaignTemplate.indexes";

/**
 * A reusable, admin-authored email template for ad campaigns.
 *
 * One row is one *locale* of a template: the siblings of a template share
 * `name` + `campaignType` and differ by `locale`. The sender picks the row
 * matching each recipient's language and falls back to `en-US`, which is why a
 * partially translated template is safe to ship.
 *
 * `bodyHtml` is author-supplied markup. It is sanitized on write and again on
 * render — see `adCampaignHtmlSanitizer`. Never interpolate it into a page or a
 * message without that pass.
 */
export interface IAdCampaignTemplate extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    campaignType: AdCampaignType;
    locale: AdCampaignLocale;
    subject: string;
    previewText?: string;
    bodyHtml: string;
    active?: boolean;
}

const AdCampaignTemplateSchema = new Schema<IAdCampaignTemplate>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: AD_CAMPAIGN_NAME_MAX,
        },
        campaignType: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_TYPE_VALUES
        },
        locale: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_LOCALE_VALUES
        },
        subject: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: AD_CAMPAIGN_SUBJECT_MAX,
        },
        previewText: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: AD_CAMPAIGN_SUBJECT_MAX,
        },
        bodyHtml: {
            type: SchemaTypes.String,
            required: true,
            minlength: 1,
            maxlength: AD_CAMPAIGN_BODY_MAX,
        },
        active: {
            type: SchemaTypes.Boolean,
            required: false,
            default: true
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(AdCampaignTemplateSchema);
auditPlugin(AdCampaignTemplateSchema);
softDeletePlugin(AdCampaignTemplateSchema);
lifeCyclePlugin(AdCampaignTemplateSchema);
applyAdCampaignTemplateIndexes(AdCampaignTemplateSchema);

const AdCampaignTemplate = model<IAdCampaignTemplate>("AdCampaignTemplate", AdCampaignTemplateSchema, "adcampaigntemplates",);
export default AdCampaignTemplate;

normalizeSchemaPermissions(AdCampaignTemplate);

addModelData(AdCampaignTemplate, adCampaignTemplateViews);
validateSchemaDefAgainstMongoose(AdCampaignTemplateSchema, AdCampaignTemplateSchemaDef, "AdCampaignTemplate");
