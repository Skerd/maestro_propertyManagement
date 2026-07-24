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
import {DesignStageSchemaDef, designStageStatusValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/designStage.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {designStageViews} from "./designStage.views";
import {applyDesignStageIndexes} from "./designStage.indexes";

export interface IDesignStage extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const DesignStageSchema = new Schema<IDesignStage>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        stageType: {type: SchemaTypes.String, enum: ["concept","schematic","design_development","construction_documents","tender","construction","as_built"], required: true},
        sortOrder: {type: SchemaTypes.Number, required: false},
        description: {type: SchemaTypes.String, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...designStageStatusValues],
            required: false,
            default: "not_started",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

DesignStageSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `DES-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(DesignStageSchema);
auditPlugin(DesignStageSchema);
softDeletePlugin(DesignStageSchema);
applyDesignStageIndexes(DesignStageSchema);

const DesignStage = model<IDesignStage>("DesignStage", DesignStageSchema, "designstages");
export default DesignStage;

normalizeSchemaPermissions(DesignStage);
addModelData(DesignStage, designStageViews);
validateSchemaDefAgainstMongoose(DesignStageSchema, DesignStageSchemaDef, "DesignStage", ["name", "status"]);
