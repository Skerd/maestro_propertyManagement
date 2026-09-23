import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ILead} from "@propertyManagement/database/schemas/lead/lead";
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
import {MarketingPreferenceSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/marketingPreference.schema-def";
import {
    MARKETING_PREFERENCE_SOURCE_VALUES,
    type MarketingPreferenceSource,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {SimpleUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {marketingPreferenceViews} from "./marketingPreference.views";
import {applyMarketingPreferenceIndexes} from "./marketingPreference.indexes";

/**
 * One person's marketing consent for one tenant, keyed by email address.
 *
 * Keyed on the address rather than a user id for three reasons: the audience
 * includes `Lead`s that have no account; an unsubscribe link carries no
 * identity beyond an email; and the same address may be both a lead and a
 * buyer, which must resolve to one consent record, not two.
 *
 * **Absence of a row means all three types are allowed** (opt-out model) — see
 * `marketingPreferenceService.getState`. Whether that default is legally right
 * depends on jurisdiction; flipping it is a change to that one function, not a
 * migration.
 */
export interface IMarketingPreference extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    email: string;
    user?: IUser;
    lead?: ILead;
    allowPriceChange: boolean;
    allowOffers: boolean;
    allowNewProjects: boolean;
    unsubscribedAllAt?: Date;
    source?: MarketingPreferenceSource;
    lastChangedAt?: Date;
}

const SYSTEM_WRITE = {self: {write: "no-permission"}, others: {write: "no-permission"}};

const MarketingPreferenceSchema = new Schema<IMarketingPreference>(
    {
        email: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 320,
        },
        user: {type: SchemaTypes.ObjectId, ref: "User", required: false, refAllowlist: SimpleUserSnippet},
        lead: {type: SchemaTypes.ObjectId, ref: "Lead", required: false},
        allowPriceChange: {type: SchemaTypes.Boolean, required: false, default: true},
        allowOffers: {type: SchemaTypes.Boolean, required: false, default: true},
        allowNewProjects: {type: SchemaTypes.Boolean, required: false, default: true},
        unsubscribedAllAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},
        source: {type: SchemaTypes.String, required: false, enum: MARKETING_PREFERENCE_SOURCE_VALUES},
        lastChangedAt: {type: SchemaTypes.Date, required: false, permissions: SYSTEM_WRITE},
    },
    {accessMode: "loose"},
);

ownershipPlugin(MarketingPreferenceSchema);
auditPlugin(MarketingPreferenceSchema);
softDeletePlugin(MarketingPreferenceSchema);
lifeCyclePlugin(MarketingPreferenceSchema);
applyMarketingPreferenceIndexes(MarketingPreferenceSchema);

const MarketingPreference = model<IMarketingPreference>(
    "MarketingPreference",
    MarketingPreferenceSchema,
    "marketingpreferences",
);
export default MarketingPreference;

normalizeSchemaPermissions(MarketingPreference);

addModelData(MarketingPreference, marketingPreferenceViews);
validateSchemaDefAgainstMongoose(
    MarketingPreferenceSchema,
    MarketingPreferenceSchemaDef,
    "MarketingPreference",
    ["unsubscribedAllAt", "lastChangedAt"],
);
