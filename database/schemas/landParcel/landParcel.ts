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
import {LandParcelSchemaDef, landParcelStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/landParcel.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {landParcelViews} from "./landParcel.views";
import {applyLandParcelIndexes} from "./landParcel.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export interface ILandParcel extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const LandParcelSchema = new Schema<ILandParcel>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: false, refAllowlist: ProjectSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        cadastralReference: {type: SchemaTypes.String, required: false},
        areaSqm: {type: SchemaTypes.Number, required: false},
        zoning: {type: SchemaTypes.String, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        acquisitionCost: {type: SchemaTypes.Decimal128, required: false},
        dueDiligenceStatus: {type: SchemaTypes.String, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},

        status: {
            type: SchemaTypes.String,
            enum: [...landParcelStatusValues],
            required: false,
            default: "prospect",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

LandParcelSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `LAND-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(LandParcelSchema);
auditPlugin(LandParcelSchema);
softDeletePlugin(LandParcelSchema);
applyLandParcelIndexes(LandParcelSchema);

const LandParcel = model<ILandParcel>("LandParcel", LandParcelSchema, "landparcels");
export default LandParcel;

normalizeSchemaPermissions(LandParcel);
addModelData(LandParcel, landParcelViews);
validateSchemaDefAgainstMongoose(LandParcelSchema, LandParcelSchemaDef, "LandParcel", ["name", "status"]);
