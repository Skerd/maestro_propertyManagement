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
import {TenderSchemaDef, tenderStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/tender.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {SpecificationSimpleSnippet} from "../specification/specification.snippets";
import {tenderViews} from "./tender.views";
import {applyTenderIndexes} from "./tender.indexes";

export interface ITender extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const TenderSchema = new Schema<ITender>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        specification: {type: SchemaTypes.ObjectId, ref: "Specification", required: true, refAllowlist: SpecificationSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        trades: {type: [SchemaTypes.String], required: false, default: undefined},
        submissionDeadline: {type: SchemaTypes.Date, required: false},
        openingDate: {type: SchemaTypes.Date, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...tenderStatusValues],
            required: false,
            default: "draft",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

TenderSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `TND-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(TenderSchema);
auditPlugin(TenderSchema);
softDeletePlugin(TenderSchema);
applyTenderIndexes(TenderSchema);

const Tender = model<ITender>("Tender", TenderSchema, "tenders");
export default Tender;

normalizeSchemaPermissions(Tender);
addModelData(Tender, tenderViews);
validateSchemaDefAgainstMongoose(TenderSchema, TenderSchemaDef, "Tender", ["name", "status"]);
