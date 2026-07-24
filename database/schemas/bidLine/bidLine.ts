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
import {BidLineSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/bidLine/bidLine.schema-def";
import {BidSimpleSnippet} from "../bid/bid.snippets";
import {SpecificationItemSimpleSnippet} from "../specificationItem/specificationItem.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {bidLineViews} from "./bidLine.views";
import {applyBidLineIndexes} from "./bidLine.indexes";

export interface IBidLine extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    [key: string]: any;
}

const BidLineSchema = new Schema<IBidLine>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        bid: {type: SchemaTypes.ObjectId, ref: "Bid", required: true, refAllowlist: BidSimpleSnippet},
        specificationItem: {type: SchemaTypes.ObjectId, ref: "SpecificationItem", required: true, refAllowlist: SpecificationItemSimpleSnippet},
        title: {type: SchemaTypes.String, required: false, trim: true},
        quantity: {type: SchemaTypes.Number, required: false},
        unitPrice: {type: SchemaTypes.Decimal128, required: false},
        lineTotal: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        alternativeNote: {type: SchemaTypes.String, required: false},
        sortIndex: {type: SchemaTypes.Number, required: false},
    },
    {accessMode: "loose"},
);

BidLineSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `BIDL-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(BidLineSchema);
auditPlugin(BidLineSchema);
softDeletePlugin(BidLineSchema);
applyBidLineIndexes(BidLineSchema);

const BidLine = model<IBidLine>("BidLine", BidLineSchema, "bidlines");
export default BidLine;

normalizeSchemaPermissions(BidLine);
addModelData(BidLine, bidLineViews);
// lineTotal is server-computed (quantity * unitPrice).
validateSchemaDefAgainstMongoose(BidLineSchema, BidLineSchemaDef, "BidLine", ["name", "lineTotal"]);
