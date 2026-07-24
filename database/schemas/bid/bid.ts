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
import {BidSchemaDef, bidStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/bid.schema-def";
import {TenderSimpleSnippet} from "../tender/tender.snippets";
import {TenderInvitationSimpleSnippet} from "../tenderInvitation/tenderInvitation.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {bidViews} from "./bid.views";
import {applyBidIndexes} from "./bid.indexes";

export interface IBid extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    status?: string;
    [key: string]: any;
}

const BidSchema = new Schema<IBid>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        tender: {type: SchemaTypes.ObjectId, ref: "Tender", required: true, refAllowlist: TenderSimpleSnippet},
        tenderInvitation: {type: SchemaTypes.ObjectId, ref: "TenderInvitation", required: false, refAllowlist: TenderInvitationSimpleSnippet},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: true, refAllowlist: ConstructorSimpleSnippet},
        total: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        coveringNotes: {type: SchemaTypes.String, required: false},
        submittedAt: {type: SchemaTypes.Date, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...bidStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

BidSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `BID-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(BidSchema);
auditPlugin(BidSchema);
softDeletePlugin(BidSchema);
applyBidIndexes(BidSchema);

const Bid = model<IBid>("Bid", BidSchema, "bids");
export default Bid;

normalizeSchemaPermissions(Bid);
addModelData(Bid, bidViews);
validateSchemaDefAgainstMongoose(BidSchema, BidSchemaDef, "Bid", ["name", "status"]);
