import {Document, model, Schema, SchemaTypes} from "mongoose";
import {ObjectId} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ILead} from "@propertyManagement/database/schemas/lead/lead";
import {IAdCampaign} from "@propertyManagement/database/schemas/adCampaign/adCampaign";
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
import {AdCampaignRecipientSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignRecipient/adCampaignRecipient.schema-def";
import {
    AD_CAMPAIGN_AUDIENCE_KIND_VALUES,
    AD_CAMPAIGN_ERROR_MAX,
    AD_CAMPAIGN_RECIPIENT_STATUS_VALUES,
    AD_CAMPAIGN_SKIP_REASON_VALUES,
    AD_CAMPAIGN_TYPE_VALUES,
    type AdCampaignAudienceKind,
    type AdCampaignRecipientStatus,
    type AdCampaignSkipReason,
    type AdCampaignType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {SimpleUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {AdCampaignSimpleSnippet} from "@propertyManagement/database/schemas/adCampaign/adCampaign.snippets";
import {adCampaignRecipientViews} from "./adCampaignRecipient.views";
import {applyAdCampaignRecipientIndexes} from "./adCampaignRecipient.indexes";

/**
 * One intended delivery: a campaign, an address, and what became of it.
 *
 * Rows are written by the materializer and updated by the sender — never by a
 * form, which is why every field is `SYSTEM_WRITE` and there are no create or
 * edit views.
 *
 * Opted-out addresses are kept here as `suppressed` rather than dropped. A
 * campaign that reached 400 of 900 people has to be able to show the other 500
 * and why, both so the numbers are explainable and so there is a consent audit
 * trail.
 */
export interface IAdCampaignRecipient extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    campaign: IAdCampaign;
    /** Denormalized from the campaign so the preference check needs no join. */
    campaignType: AdCampaignType;
    audienceKind: AdCampaignAudienceKind;
    user?: IUser;
    lead?: ILead;
    email: string;
    fullName?: string;
    languageCode?: string;
    status: AdCampaignRecipientStatus;
    skipReason?: AdCampaignSkipReason;
    attempts: number;
    /** When a worker claimed this row; drives the stuck-row reclaim. */
    claimedAt?: Date;
    /** Identifies the batch one worker won, so it can read back exactly its own rows. */
    claimToken?: ObjectId;
    sentAt?: Date;
    messageId?: string;
    lastError?: string;
    unsubscribedAt?: Date;
}

const SYSTEM_WRITE = {self: {write: "no-permission"}, others: {write: "no-permission"}};

const AdCampaignRecipientSchema = new Schema<IAdCampaignRecipient>(
    {
        campaign: {
            type: SchemaTypes.ObjectId,
            ref: "AdCampaign",
            required: true,
            refAllowlist: AdCampaignSimpleSnippet,
            permissions: SYSTEM_WRITE,
        },
        campaignType: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_TYPE_VALUES,
            permissions: SYSTEM_WRITE,
        },
        audienceKind: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_AUDIENCE_KIND_VALUES,
            permissions: SYSTEM_WRITE,
        },
        user: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: false,
            refAllowlist: SimpleUserSnippet,
            permissions: SYSTEM_WRITE,
        },
        lead: {type: SchemaTypes.ObjectId, ref: "Lead", required: false, permissions: SYSTEM_WRITE},
        email: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 320,
            permissions: SYSTEM_WRITE,
        },
        fullName: {type: SchemaTypes.String, required: false, trim: true, maxlength: 200, permissions: SYSTEM_WRITE},
        languageCode: {type: SchemaTypes.String, required: false, trim: true, maxlength: 10, permissions: SYSTEM_WRITE},
        status: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_RECIPIENT_STATUS_VALUES,
            default: "pending",
            permissions: SYSTEM_WRITE,
        },
        skipReason: {
            type: SchemaTypes.String,
            required: false,
            enum: AD_CAMPAIGN_SKIP_REASON_VALUES,
            permissions: SYSTEM_WRITE,
        },
        attempts: {type: SchemaTypes.Number, required: false, default: 0, min: 0, permissions: SYSTEM_WRITE},
        claimedAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},
        claimToken: {type: SchemaTypes.ObjectId, required: false, permissions: SYSTEM_WRITE},
        sentAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},
        messageId: {type: SchemaTypes.String, required: false, trim: true, maxlength: 255, permissions: SYSTEM_WRITE},
        lastError: {
            type: SchemaTypes.String,
            required: false,
            maxlength: AD_CAMPAIGN_ERROR_MAX,
            permissions: SYSTEM_WRITE,
        },
        unsubscribedAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},
    },
    {accessMode: "loose"},
);

ownershipPlugin(AdCampaignRecipientSchema);
auditPlugin(AdCampaignRecipientSchema);
softDeletePlugin(AdCampaignRecipientSchema);
lifeCyclePlugin(AdCampaignRecipientSchema);
applyAdCampaignRecipientIndexes(AdCampaignRecipientSchema);

const AdCampaignRecipient = model<IAdCampaignRecipient>("AdCampaignRecipient", AdCampaignRecipientSchema, "adcampaignrecipients",);
export default AdCampaignRecipient;

normalizeSchemaPermissions(AdCampaignRecipient);

addModelData(AdCampaignRecipient, adCampaignRecipientViews);
validateSchemaDefAgainstMongoose(AdCampaignRecipientSchema, AdCampaignRecipientSchemaDef, "AdCampaignRecipient", ["claimedAt", "claimToken"]);
