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
import {WarrantySchemaDef, warrantyStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/warranty.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {warrantyViews} from "./warranty.views";
import {applyWarrantyIndexes} from "./warranty.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";

export interface IWarranty extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const WarrantySchema = new Schema<IWarranty>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        unit: {type: SchemaTypes.ObjectId, ref: "Unit", required: false, refAllowlist: UnitSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        startDate: {type: SchemaTypes.Date, required: true},
        endDate: {type: SchemaTypes.Date, required: true},
        retentionAmount: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        retentionReleaseDate: {type: SchemaTypes.Date, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...warrantyStatusValues],
            required: false,
            default: "active",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

WarrantySchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `WAR-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(WarrantySchema);
auditPlugin(WarrantySchema);
softDeletePlugin(WarrantySchema);
applyWarrantyIndexes(WarrantySchema);

const Warranty = model<IWarranty>("Warranty", WarrantySchema, "warranties");
export default Warranty;

normalizeSchemaPermissions(Warranty);
addModelData(Warranty, warrantyViews);
validateSchemaDefAgainstMongoose(WarrantySchema, WarrantySchemaDef, "Warranty", ["name", "status"]);
