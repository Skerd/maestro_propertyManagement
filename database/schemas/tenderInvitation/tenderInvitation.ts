import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {TenderInvitationSchemaDef, tenderInvitationStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/tenderInvitation.schema-def";
import {TenderSimpleSnippet} from "../tender/tender.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {tenderInvitationViews} from "./tenderInvitation.views";
import {applyTenderInvitationIndexes} from "./tenderInvitation.indexes";

export interface ITenderInvitation extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    status?: string;
    portalAccessToken?: string;
    [key: string]: any;
}

const TenderInvitationSchema = new Schema<ITenderInvitation>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        tender: {type: SchemaTypes.ObjectId, ref: "Tender", required: true, refAllowlist: TenderSimpleSnippet},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: true, refAllowlist: ConstructorSimpleSnippet},
        invitedAt: {type: SchemaTypes.Date, required: false},
        respondedAt: {type: SchemaTypes.Date, required: false},
        portalAccessToken: {
            type: SchemaTypes.String,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...tenderInvitationStatusValues],
            required: false,
            default: "invited",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

TenderInvitationSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `TINV-${date}-${suffix}`;
    }
    if (!this.invitedAt) this.invitedAt = new Date();
    if (!this.portalAccessToken) this.portalAccessToken = crypto.randomBytes(24).toString("hex");
    next();
});

ownershipPlugin(TenderInvitationSchema);
auditPlugin(TenderInvitationSchema);
softDeletePlugin(TenderInvitationSchema);
applyTenderInvitationIndexes(TenderInvitationSchema);

const TenderInvitation = model<ITenderInvitation>("TenderInvitation", TenderInvitationSchema, "tenderinvitations");
export default TenderInvitation;

normalizeSchemaPermissions(TenderInvitation);
addModelData(TenderInvitation, tenderInvitationViews);
validateSchemaDefAgainstMongoose(TenderInvitationSchema, TenderInvitationSchemaDef, "TenderInvitation", ["name", "status", "portalAccessToken"]);
