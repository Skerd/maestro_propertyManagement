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
import {SpecificationSchemaDef, specificationStatusValues, specificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/specification.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {WorkPackageSimpleSnippet} from "../workPackage/workPackage.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {specificationViews} from "./specification.views";
import {applySpecificationIndexes} from "./specification.indexes";

export interface ISpecification extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const SpecificationSchema = new Schema<ISpecification>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        workPackage: {type: SchemaTypes.ObjectId, ref: "WorkPackage", required: false, refAllowlist: WorkPackageSimpleSnippet},
        standard: {type: SchemaTypes.String, enum: [...specificationStandardValues], required: false, default: "npk"},
        title: {type: SchemaTypes.String, required: true, trim: true},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
        totalEstimated: {type: SchemaTypes.Decimal128, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...specificationStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

SpecificationSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `LV-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(SpecificationSchema);
auditPlugin(SpecificationSchema);
softDeletePlugin(SpecificationSchema);
applySpecificationIndexes(SpecificationSchema);

const Specification = model<ISpecification>("Specification", SpecificationSchema, "specifications");
export default Specification;

normalizeSchemaPermissions(Specification);
addModelData(Specification, specificationViews);
validateSchemaDefAgainstMongoose(SpecificationSchema, SpecificationSchemaDef, "Specification", ["name", "status"]);
