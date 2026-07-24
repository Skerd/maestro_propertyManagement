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
import {ConstructionContractSchemaDef, constructionContractStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/constructionContract.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {constructionContractViews} from "./constructionContract.views";
import {applyConstructionContractIndexes} from "./constructionContract.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface IConstructionContract extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const ConstructionContractSchema = new Schema<IConstructionContract>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        workPackage: {type: SchemaTypes.ObjectId, ref: "WorkPackage", required: false},
        constructorRef: {type: SchemaTypes.ObjectId, ref: "Constructor", required: true},
        title: {type: SchemaTypes.String, required: true, trim: true},
        description: {type: SchemaTypes.String, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        contractValue: {type: SchemaTypes.Decimal128, required: true},
        retentionPercent: {type: SchemaTypes.Number, required: false},
        performanceBond: {type: SchemaTypes.Decimal128, required: false},
        paymentTerms: {type: SchemaTypes.String, required: false},
        startDate: {type: SchemaTypes.Date, required: false},
        endDate: {type: SchemaTypes.Date, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        // Derived cost truth — recomputed by recomputeContractCostTruth on VO approval / claim certification
        approvedVariationsTotal: {
            type: SchemaTypes.Decimal128,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
        certifiedClaimsTotal: {
            type: SchemaTypes.Decimal128,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },

        status: {
            type: SchemaTypes.String,
            enum: [...constructionContractStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

ConstructionContractSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `CCON-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(ConstructionContractSchema);
auditPlugin(ConstructionContractSchema);
softDeletePlugin(ConstructionContractSchema);
applyConstructionContractIndexes(ConstructionContractSchema);

const ConstructionContract = model<IConstructionContract>("ConstructionContract", ConstructionContractSchema, "constructioncontracts");
export default ConstructionContract;

normalizeSchemaPermissions(ConstructionContract);
addModelData(ConstructionContract, constructionContractViews);
validateSchemaDefAgainstMongoose(ConstructionContractSchema, ConstructionContractSchemaDef, "ConstructionContract", ["name", "status", "approvedVariationsTotal", "certifiedClaimsTotal"]);
