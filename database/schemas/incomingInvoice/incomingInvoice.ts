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
import {IncomingInvoiceSchemaDef, incomingInvoiceStatusValues, incomingInvoiceOcrStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/incomingInvoice.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {ContractorInvoiceSimpleSnippet} from "../contractorInvoice/contractorInvoice.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {incomingInvoiceViews} from "./incomingInvoice.views";
import {applyIncomingInvoiceIndexes} from "./incomingInvoice.indexes";

export interface IIncomingInvoice extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    status?: string;
    ocrStatus?: string;
    [key: string]: any;
}

const IncomingInvoiceSchema = new Schema<IIncomingInvoice>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        title: {type: SchemaTypes.String, required: false, trim: true},
        project: {type: SchemaTypes.ObjectId, ref: "Project", required: false, refAllowlist: ProjectSimpleSnippet},
        extractedSupplierName: {type: SchemaTypes.String, required: false, trim: true},
        extractedIban: {type: SchemaTypes.String, required: false, trim: true},
        extractedAmount: {type: SchemaTypes.Decimal128, required: false},
        extractedCurrencyCode: {type: SchemaTypes.String, required: false, trim: true},
        extractedInvoiceNumber: {type: SchemaTypes.String, required: false, trim: true},
        extractedInvoiceDate: {type: SchemaTypes.Date, required: false},
        extractedDueDate: {type: SchemaTypes.Date, required: false},
        extractedQrReference: {type: SchemaTypes.String, required: false, trim: true},
        matchedConstructor: {type: SchemaTypes.ObjectId, ref: "Constructor", required: false, refAllowlist: ConstructorSimpleSnippet},
        matchedContract: {type: SchemaTypes.ObjectId, ref: "ConstructionContract", required: false},
        bkpAccountCode: {type: SchemaTypes.String, required: false, trim: true},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        createdContractorInvoice: {type: SchemaTypes.ObjectId, ref: "ContractorInvoice", required: false, refAllowlist: ContractorInvoiceSimpleSnippet, permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}}},
        notes: {type: SchemaTypes.String, required: false},

        ocrStatus: {
            type: SchemaTypes.String,
            enum: [...incomingInvoiceOcrStatusValues],
            required: false,
            default: "pending",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        status: {
            type: SchemaTypes.String,
            enum: [...incomingInvoiceStatusValues],
            required: false,
            default: "inbox",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

IncomingInvoiceSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `AP-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(IncomingInvoiceSchema);
auditPlugin(IncomingInvoiceSchema);
softDeletePlugin(IncomingInvoiceSchema);
applyIncomingInvoiceIndexes(IncomingInvoiceSchema);

const IncomingInvoice = model<IIncomingInvoice>("IncomingInvoice", IncomingInvoiceSchema, "incominginvoices");
export default IncomingInvoice;

normalizeSchemaPermissions(IncomingInvoice);
addModelData(IncomingInvoice, incomingInvoiceViews);
validateSchemaDefAgainstMongoose(IncomingInvoiceSchema, IncomingInvoiceSchemaDef, "IncomingInvoice", ["name", "status", "ocrStatus", "createdContractorInvoice"]);
