import * as crypto from "crypto";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {Decimal128} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IChannel} from "@coreModule/database/schemas/channel/channel";
import {IProject} from "../project/project";
import {IUnit} from "../unit/unit";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {leadViews} from "./lead.views";
import {applyLeadIndexes} from "./lead.indexes";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {LeadSchemaDef, LEAD_EMAIL_MAX, LEAD_LONG_TEXT_MAX, LEAD_PHONE_MAX, LEAD_SHORT_TEXT_MAX} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.schema-def";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {ChannelLeadChatSnippet} from "@coreModule/database/schemas/channel/channel.snippets";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export enum LeadStatus {
    NEW         = "new",
    CONTACTED   = "contacted",
    QUALIFIED   = "qualified",
    PROPOSAL    = "proposal",
    NEGOTIATION = "negotiation",
    WON         = "won",
    LOST        = "lost",
}

export enum LeadSource {
    WEBSITE   = "website",
    REFERRAL  = "referral",
    SOCIAL    = "social",
    EVENT     = "event",
    COLD_CALL = "cold_call",
    WALK_IN   = "walk_in",
    CHAT      = "chat",
    OTHER     = "other",
}

export enum LeadInterest {
    PARTNERSHIPS     = "partnerships",
    INVESTMENTS      = "investments",
    PLATFORM_SUPPORT = "platform_support",
    RESERVATION      = "reservation",
    OTHER            = "other",
}

export interface ILeadActivityEntry {
    _id?: any;
    action: string;
    notes?: string;
    performedBy?: IUser;
    performedAt: Date;
}

export interface ILead extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    status: LeadStatus;
    source?: LeadSource;
    interest?: LeadInterest;
    projectInterest?: IProject;
    unitInterest?: IUnit;
    budget?: Decimal128;
    budgetCurrency?: ICurrency;
    notes?: string;
    chat?: IChannel;
    assignedTo?: IUser;
    followUpDate?: Date;
    convertedAt?: Date;
    activityLog: ILeadActivityEntry[];
}

const LeadSchema = new Schema<ILead>(
    {
        name: {
            type: SchemaTypes.String,
            trim: true,
            immutable: true,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        firstName: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: LEAD_SHORT_TEXT_MAX,
        },
        lastName: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: LEAD_SHORT_TEXT_MAX,
        },
        email: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            lowercase: true,
            maxlength: LEAD_EMAIL_MAX,
        },
        phone: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: LEAD_PHONE_MAX,
        },
        status: {
            type:     SchemaTypes.String,
            required: true,
            enum:     Object.values(LeadStatus),
            default:  LeadStatus.NEW,
        },
        source: {
            type:     SchemaTypes.String,
            required: false,
            enum:     Object.values(LeadSource),
        },
        interest: {
            type:     SchemaTypes.String,
            required: false,
            enum:     Object.values(LeadInterest),
        },
        projectInterest: {
            type:         SchemaTypes.ObjectId,
            ref:          "Project",
            required:     false,
            refAllowlist: ProjectSimpleSnippet,
        },
        unitInterest: {
            type:         SchemaTypes.ObjectId,
            ref:          "Unit",
            required:     false,
            refAllowlist: UnitSimpleSnippet,
        },
        budget: {
            type:     SchemaTypes.Decimal128,
            required: false,
        },
        budgetCurrency: {
            type:         SchemaTypes.ObjectId,
            ref:          "Currency",
            required:     false,
            refAllowlist: CurrencySimpleSnippet,
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: LEAD_LONG_TEXT_MAX,
        },
        chat: {
            type:         SchemaTypes.ObjectId,
            ref:          "Channel",
            required:     false,
            refAllowlist: ChannelLeadChatSnippet,
            permissions:  {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                refDisplayKey: ["name"],
                hrefTemplate:  "/company/websiteChats/mine?channelId={_id}",
                filterable:    true,
                sortable:      true,
            },
        },
        assignedTo: {
            type:         SchemaTypes.ObjectId,
            ref:          "User",
            required:     false,
            refAllowlist: SimpleBlankUserSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ["name", "surname"],
            },
        },
        followUpDate: {type: SchemaTypes.Date, required: false},
        convertedAt:  {
            type:        SchemaTypes.Date,
            required:    false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        activityLog: {
            type: [{
                action: {
                    type: SchemaTypes.String,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    }
                },
                notes: {
                    type: SchemaTypes.String,
                    required: false,
                    maxlength: LEAD_LONG_TEXT_MAX,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    }
                },
                performedBy: {
                    type:         SchemaTypes.ObjectId,
                    ref:          "User",
                    required:     false,
                    refAllowlist: SimpleBlankUserSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    }
                },
                performedAt: {
                    type: SchemaTypes.Date,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    }
                },
            }],
            default:     [],
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

LeadSchema.pre("save", function (next) {
    if (!this.name) {
        const now  = new Date();
        const y    = now.getFullYear();
        const m    = String(now.getMonth() + 1).padStart(2, "0");
        const d    = String(now.getDate()).padStart(2, "0");
        const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name  = `LEAD-${y}${m}${d}-${rand}`;
    }
    next();
});

ownershipPlugin(LeadSchema);
auditPlugin(LeadSchema);
softDeletePlugin(LeadSchema);
lifeCyclePlugin(LeadSchema);
applyLeadIndexes(LeadSchema);

const Lead = model<ILead>("Lead", LeadSchema);
export default Lead;

normalizeSchemaPermissions(Lead);
addModelData(Lead, leadViews);
// budget stored as Decimal128; status has default so required check is waived; activityLog/convertedAt are server-managed
validateSchemaDefAgainstMongoose(LeadSchema, LeadSchemaDef, "Lead", ["activityLog", "convertedAt", "name", "chat"]);
