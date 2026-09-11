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
import {
    HandoverPackageSchemaDef,
    handoverItemImportanceValues,
    HANDOVER_PACKAGE_ITEM_NAME_MAX,
    HANDOVER_PACKAGE_ITEM_TEXT_MAX,
    HANDOVER_PACKAGE_LONG_TEXT_MAX,
    HANDOVER_PACKAGE_TITLE_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {FloorSimpleSnippet} from "../floor/floor.snippets";
import {handoverPackageViews} from "./handoverPackage.views";
import {applyHandoverPackageIndexes} from "./handoverPackage.indexes";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";

export interface IHandoverPackage extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    [key: string]: any;
}

const HandoverPackageSchema = new Schema<IHandoverPackage>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        project: {type: SchemaTypes.ObjectId, ref: "Project", required: true, refAllowlist: ProjectSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, default: null, refAllowlist: EdificeSimpleSnippet},
        floor: {type: SchemaTypes.ObjectId, ref: "Floor", required: false, default: null, refAllowlist: FloorSimpleSnippet},
        unit: {type: SchemaTypes.ObjectId, ref: "Unit", required: false, default: null, refAllowlist: UnitSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true, maxlength: HANDOVER_PACKAGE_TITLE_MAX},
        description: {type: SchemaTypes.String, required: false, maxlength: HANDOVER_PACKAGE_LONG_TEXT_MAX},
        notes: {type: SchemaTypes.String, required: false, maxlength: HANDOVER_PACKAGE_LONG_TEXT_MAX},
        media: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet},
        items: {
            type: [{
                name: {type: SchemaTypes.String, required: true, trim: true, maxlength: HANDOVER_PACKAGE_ITEM_NAME_MAX},
                description: {type: SchemaTypes.String, required: false, trim: true, maxlength: HANDOVER_PACKAGE_ITEM_TEXT_MAX},
                instructions: {type: SchemaTypes.String, required: false, trim: true, maxlength: HANDOVER_PACKAGE_ITEM_TEXT_MAX},
                importance: {type: SchemaTypes.String, enum: [...handoverItemImportanceValues], required: false},
            }],
            default: [],
        },
    },
    {accessMode: "loose"},
);

HandoverPackageSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `HO-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(HandoverPackageSchema);
auditPlugin(HandoverPackageSchema);
softDeletePlugin(HandoverPackageSchema);
applyHandoverPackageIndexes(HandoverPackageSchema);

const HandoverPackage = model<IHandoverPackage>("HandoverPackage", HandoverPackageSchema, "handoverpackages");
export default HandoverPackage;

normalizeSchemaPermissions(HandoverPackage);
addModelData(HandoverPackage, handoverPackageViews);
validateSchemaDefAgainstMongoose(HandoverPackageSchema, HandoverPackageSchemaDef, "HandoverPackage", ["name"]);
