import * as crypto from "crypto";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {Decimal128} from "mongodb";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUnit} from "../unit/unit";
import {ILease} from "../lease/lease";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {rentalPaymentViews} from "./rentalPayment.views";
import {applyRentalPaymentIndexes} from "./rentalPayment.indexes";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {RentalPaymentSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {LeaseSimpleSnippet} from "../lease/lease.snippets";

export enum RentalPaymentStatus {
    PENDING = "pending",
    PAID    = "paid",
    OVERDUE = "overdue",
    WAIVED  = "waived",
}

export interface IRentalPayment extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name?: string;
    lease: ILease;
    unit: IUnit;
    dueDate: Date;
    amount: Decimal128;
    currency: ICurrency;
    status: RentalPaymentStatus;
    paidDate?: Date;
    paidAmount?: Decimal128;
    notes?: string;
    receiptMedia?: IMedia;
}

const RentalPaymentSchema = new Schema<IRentalPayment>(
    {
        name: {
            type:        SchemaTypes.String,
            trim:        true,
            immutable:   true,
            required:    false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        lease: {
            type:         SchemaTypes.ObjectId,
            ref:          "Lease",
            required:     true,
            refAllowlist: LeaseSimpleSnippet,
        },
        unit: {
            type:         SchemaTypes.ObjectId,
            ref:          "Unit",
            required:     true,
            refAllowlist: UnitSimpleSnippet,
        },
        dueDate:    {type: SchemaTypes.Date,       required: true},
        amount:     {type: SchemaTypes.Decimal128,  required: true},
        currency: {
            type:         SchemaTypes.ObjectId,
            ref:          "Currency",
            required:     true,
            refAllowlist: CurrencySimpleSnippet,
        },
        status: {
            type:     SchemaTypes.String,
            required: true,
            enum:     Object.values(RentalPaymentStatus),
            default:  RentalPaymentStatus.PENDING,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        paidDate:   {type: SchemaTypes.Date,      required: false},
        paidAmount: {type: SchemaTypes.Decimal128, required: false},
        notes:      {type: SchemaTypes.String,     required: false, trim: true},
        receiptMedia: {
            type:         SchemaTypes.ObjectId,
            ref:          "Media",
            required:     false,
            refAllowlist: MediaSimpleSnippet,
        },
    },
    {accessMode: "loose"},
);

RentalPaymentSchema.pre("save", function (next) {
    if (!this.name) {
        const now  = new Date();
        const y    = now.getFullYear();
        const m    = String(now.getMonth() + 1).padStart(2, "0");
        const d    = String(now.getDate()).padStart(2, "0");
        const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name  = `RPAY-${y}${m}${d}-${rand}`;
    }
    next();
});

ownershipPlugin(RentalPaymentSchema);
auditPlugin(RentalPaymentSchema);
softDeletePlugin(RentalPaymentSchema);
applyRentalPaymentIndexes(RentalPaymentSchema);

const RentalPayment = model<IRentalPayment>("RentalPayment", RentalPaymentSchema);
normalizeSchemaPermissions(RentalPayment);
export default RentalPayment;

addModelData(RentalPayment, rentalPaymentViews);
validateSchemaDefAgainstMongoose(RentalPaymentSchema, RentalPaymentSchemaDef, "RentalPayment", [
    // name: auto-generated; status/unit/paidDate: server or action-managed
    "name", "status", "paidDate", "unit",
]);
