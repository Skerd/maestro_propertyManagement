import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {ObjectId} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {IProject} from "@propertyManagement/database/schemas/project/project";
import {IUnit} from "@propertyManagement/database/schemas/unit/unit";
import {ILead} from "@propertyManagement/database/schemas/lead/lead";
import {IAdCampaignTemplate} from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate";
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
import {AdCampaignSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.schema-def";
import {
    AD_CAMPAIGN_AUDIENCE_MODE_VALUES,
    AD_CAMPAIGN_BATCH_SIZE_DEFAULT,
    AD_CAMPAIGN_BATCH_SIZE_MAX,
    AD_CAMPAIGN_BATCH_SIZE_MIN,
    AD_CAMPAIGN_BODY_MAX,
    AD_CAMPAIGN_ERROR_MAX,
    AD_CAMPAIGN_NAME_MAX,
    AD_CAMPAIGN_STATUS_VALUES,
    AD_CAMPAIGN_SUBJECT_MAX,
    AD_CAMPAIGN_TITLE_MAX,
    AD_CAMPAIGN_TYPE_VALUES,
    type AdCampaignAudienceMode,
    type AdCampaignStatus,
    type AdCampaignType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {SimpleUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {AdCampaignTemplateSimpleSnippet} from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate.snippets";
import {adCampaignViews} from "./adCampaign.views";
import {applyAdCampaignIndexes} from "./adCampaign.indexes";

/** Progress counters, recomputed authoritatively from the recipient rows on completion. */
export interface IAdCampaignStats {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    skipped: number;
}

/**
 * A staff-authored marketing campaign: one email, one audience, sent in batches.
 *
 * The audience is materialized into `AdCampaignRecipient` rows before any mail
 * goes out, so a send is resumable, auditable and idempotent. `stats` mirrors
 * those rows for cheap display — the rows are the source of truth.
 *
 * Machine-written fields (`name`, `status`, `startedAt`, `completedAt`, `stats`,
 * `lastError`) are `SYSTEM_WRITE`: an author who could PATCH `status` straight
 * to `sending` would skip materialization and mail an empty or stale audience.
 */
export interface IAdCampaign extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    title: string;
    campaignType: AdCampaignType;
    status: AdCampaignStatus;

    template: IAdCampaignTemplate;
    subjectOverride?: string;
    bodyHtmlOverride?: string;

    audienceMode: AdCampaignAudienceMode;
    recipients: IUser[];
    leadRecipients: ILead[];
    includeClientUsers?: boolean;
    includeLeads?: boolean;

    projects: IProject[];
    units: IUnit[];

    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;

    batchSize?: number;
    fromName?: string;
    replyTo?: string;

    stats: IAdCampaignStats;
    lastError?: string;

    /** Set by the sender while a worker holds this campaign; cleared on release. */
    claimToken?: ObjectId;
}

const SYSTEM_WRITE = {self: {write: "no-permission"}, others: {write: "no-permission"}};

const AdCampaignSchema = new Schema<IAdCampaign>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            maxlength: AD_CAMPAIGN_NAME_MAX,
            permissions: SYSTEM_WRITE,
        },
        title: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: AD_CAMPAIGN_TITLE_MAX,
        },
        campaignType: {type: SchemaTypes.String, required: true, enum: AD_CAMPAIGN_TYPE_VALUES},
        status: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_STATUS_VALUES,
            default: "draft",
            permissions: SYSTEM_WRITE,
        },

        template: {
            type: SchemaTypes.ObjectId,
            ref: "AdCampaignTemplate",
            required: true,
            refAllowlist: AdCampaignTemplateSimpleSnippet,
        },
        subjectOverride: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: AD_CAMPAIGN_SUBJECT_MAX,
        },
        bodyHtmlOverride: {
            type: SchemaTypes.String,
            required: false,
            maxlength: AD_CAMPAIGN_BODY_MAX,
        },

        audienceMode: {
            type: SchemaTypes.String,
            required: true,
            enum: AD_CAMPAIGN_AUDIENCE_MODE_VALUES,
            default: "selected",
        },
        recipients: {
            type: [{type: SchemaTypes.ObjectId, ref: "User", refAllowlist: SimpleUserSnippet}],
            default: [],
        },
        leadRecipients: {
            type: [{type: SchemaTypes.ObjectId, ref: "Lead"}],
            default: [],
        },
        includeClientUsers: {type: SchemaTypes.Boolean, required: false, default: true},
        includeLeads: {type: SchemaTypes.Boolean, required: false, default: false},

        projects: {
            type: [{type: SchemaTypes.ObjectId, ref: "Project", refAllowlist: ProjectSimpleSnippet}],
            default: [],
        },
        units: {
            type: [{type: SchemaTypes.ObjectId, ref: "Unit"}],
            default: [],
        },

        scheduledAt: {type: SchemaTypes.Date, required: false},
        startedAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},
        completedAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},

        batchSize: {
            type: SchemaTypes.Number,
            required: false,
            default: AD_CAMPAIGN_BATCH_SIZE_DEFAULT,
            min: AD_CAMPAIGN_BATCH_SIZE_MIN,
            max: AD_CAMPAIGN_BATCH_SIZE_MAX,
        },
        fromName: {type: SchemaTypes.String, required: false, trim: true, maxlength: 120},
        replyTo: {type: SchemaTypes.String, required: false, trim: true, lowercase: true, maxlength: 320},

        stats: {
            type: {
                total: {type: SchemaTypes.Number, default: 0},
                pending: {type: SchemaTypes.Number, default: 0},
                sent: {type: SchemaTypes.Number, default: 0},
                failed: {type: SchemaTypes.Number, default: 0},
                skipped: {type: SchemaTypes.Number, default: 0},
            },
            default: () => ({total: 0, pending: 0, sent: 0, failed: 0, skipped: 0}),
            permissions: SYSTEM_WRITE,
        },
        lastError: {
            type: SchemaTypes.String,
            required: false,
            maxlength: AD_CAMPAIGN_ERROR_MAX,
            permissions: SYSTEM_WRITE,
        },
        claimToken: {type: SchemaTypes.ObjectId, required: false, permissions: SYSTEM_WRITE},
    },
    {accessMode: "loose"},
);

AdCampaignSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `CMP-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(AdCampaignSchema);
auditPlugin(AdCampaignSchema);
softDeletePlugin(AdCampaignSchema);
lifeCyclePlugin(AdCampaignSchema);
applyAdCampaignIndexes(AdCampaignSchema);

const AdCampaign = model<IAdCampaign>("AdCampaign", AdCampaignSchema, "adcampaigns");
export default AdCampaign;

normalizeSchemaPermissions(AdCampaign);

addModelData(AdCampaign, adCampaignViews);
validateSchemaDefAgainstMongoose(AdCampaignSchema, AdCampaignSchemaDef, "AdCampaign", [
    "name",
    "status",
    "startedAt",
    "completedAt",
    "stats",
    "lastError",
    "claimToken",
]);
