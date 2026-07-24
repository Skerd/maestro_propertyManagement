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
import {ConsultantAppointmentSchemaDef, consultantAppointmentStatusValues, consultantFeeModelValues, consultantBasisKindValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/consultantAppointment/consultantAppointment.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {consultantAppointmentViews} from "./consultantAppointment.views";
import {applyConsultantAppointmentIndexes} from "./consultantAppointment.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface IConsultantAppointment extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const ConsultantAppointmentSchema = new Schema<IConsultantAppointment>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: true},
        title: {type: SchemaTypes.String, required: true, trim: true},
        role: {type: SchemaTypes.String, enum: ["architect","engineer","qs","pm","surveyor","other"], required: true},
        scope: {type: SchemaTypes.String, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        feeAmount: {type: SchemaTypes.Decimal128, required: false},
        feeModel: {type: SchemaTypes.String, enum: [...consultantFeeModelValues], required: false},
        basisKind: {type: SchemaTypes.String, enum: [...consultantBasisKindValues], required: false},
        adjustmentFactor: {type: SchemaTypes.Number, required: false},
        hourlyRate: {type: SchemaTypes.Decimal128, required: false},
        cappedAmount: {type: SchemaTypes.Decimal128, required: false},
        startDate: {type: SchemaTypes.Date, required: false},
        endDate: {type: SchemaTypes.Date, required: false},
        deliverables: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...consultantAppointmentStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

ConsultantAppointmentSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `APPT-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ConsultantAppointmentSchema);
auditPlugin(ConsultantAppointmentSchema);
softDeletePlugin(ConsultantAppointmentSchema);
applyConsultantAppointmentIndexes(ConsultantAppointmentSchema);

const ConsultantAppointment = model<IConsultantAppointment>("ConsultantAppointment", ConsultantAppointmentSchema, "consultantappointments");
export default ConsultantAppointment;

normalizeSchemaPermissions(ConsultantAppointment);
addModelData(ConsultantAppointment, consultantAppointmentViews);
validateSchemaDefAgainstMongoose(ConsultantAppointmentSchema, ConsultantAppointmentSchemaDef, "ConsultantAppointment", ["name", "status"]);
