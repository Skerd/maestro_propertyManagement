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
import {ContractorInvoiceSchemaDef, contractorInvoiceStatusValues, contractorInvoiceSourceValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/contractorInvoice.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {contractorInvoiceViews} from "./contractorInvoice.views";
import {applyContractorInvoiceIndexes} from "./contractorInvoice.indexes";

export interface IContractorInvoice extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    status?: string;
    [key: string]: any;
}

const ContractorInvoiceSchema = new Schema<IContractorInvoice>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: true, refAllowlist: ConstructorSimpleSnippet},
        constructionContract: {type: SchemaTypes.ObjectId, ref: "ConstructionContract", required: false},
        costCommitment: {type: SchemaTypes.ObjectId, ref: "CostCommitment", required: false},
        progressClaim: {type: SchemaTypes.ObjectId, ref: "ProgressClaim", required: false},
        invoiceNumber: {type: SchemaTypes.String, required: false, trim: true},
        invoiceDate: {type: SchemaTypes.Date, required: false},
        dueDate: {type: SchemaTypes.Date, required: false},
        grossAmount: {type: SchemaTypes.Decimal128, required: false},
        netAmount: {type: SchemaTypes.Decimal128, required: false},
        vatAmount: {type: SchemaTypes.Decimal128, required: false},
        retentionHeld: {type: SchemaTypes.Decimal128, required: false},
        bkpAccountCode: {type: SchemaTypes.String, required: false, trim: true},
        qrBillReference: {type: SchemaTypes.String, required: false, trim: true},
        source: {type: SchemaTypes.String, enum: [...contractorInvoiceSourceValues], required: false, default: "manual"},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...contractorInvoiceStatusValues],
            required: false,
            default: "received",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

ContractorInvoiceSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `CINV-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ContractorInvoiceSchema);
auditPlugin(ContractorInvoiceSchema);
softDeletePlugin(ContractorInvoiceSchema);
applyContractorInvoiceIndexes(ContractorInvoiceSchema);

const ContractorInvoice = model<IContractorInvoice>("ContractorInvoice", ContractorInvoiceSchema, "contractorinvoices");
export default ContractorInvoice;

normalizeSchemaPermissions(ContractorInvoice);
addModelData(ContractorInvoice, contractorInvoiceViews);
validateSchemaDefAgainstMongoose(ContractorInvoiceSchema, ContractorInvoiceSchemaDef, "ContractorInvoice", ["name", "status"]);
