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
import {FeeCalculationSchemaDef, feeCalculationStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/feeCalculation.schema-def";
import {ConsultantAppointmentSimpleSnippet} from "../consultantAppointment/consultantAppointment.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {feeCalculationViews} from "./feeCalculation.views";
import {applyFeeCalculationIndexes} from "./feeCalculation.indexes";

export interface IFeeCalculation extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    status?: string;
    [key: string]: any;
}

const FeeCalculationSchema = new Schema<IFeeCalculation>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        consultantAppointment: {type: SchemaTypes.ObjectId, ref: "ConsultantAppointment", required: true, refAllowlist: ConsultantAppointmentSimpleSnippet},
        basisAmount: {type: SchemaTypes.Decimal128, required: false},
        feePercent: {type: SchemaTypes.Number, required: false},
        adjustmentFactor: {type: SchemaTypes.Number, required: false},
        totalFee: {type: SchemaTypes.Decimal128, required: false, permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}}},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...feeCalculationStatusValues],
            required: false,
            default: "planned",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

FeeCalculationSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `FEE-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(FeeCalculationSchema);
auditPlugin(FeeCalculationSchema);
softDeletePlugin(FeeCalculationSchema);
applyFeeCalculationIndexes(FeeCalculationSchema);

const FeeCalculation = model<IFeeCalculation>("FeeCalculation", FeeCalculationSchema, "feecalculations");
export default FeeCalculation;

normalizeSchemaPermissions(FeeCalculation);
addModelData(FeeCalculation, feeCalculationViews);
validateSchemaDefAgainstMongoose(FeeCalculationSchema, FeeCalculationSchemaDef, "FeeCalculation", ["name", "status", "totalFee"]);
