import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields,
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    StoryTypeSchemaDef,
    STORY_TYPE_DESCRIPTION_MAX,
    STORY_TYPE_NAME_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/storyType/storyType.schema-def";
import {applyStoryTypeIndexes} from "./storyType.indexes";
import {storyTypeViews} from "./storyType.views";

export interface IStoryType extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    slug: string;
    description?: string;
    sortOrder: number;
}

const StoryTypeSchema = new Schema<IStoryType>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
            trim: true,
            minlength: 1,
            maxlength: STORY_TYPE_NAME_MAX,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        slug: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 1,
            maxlength: STORY_TYPE_NAME_MAX,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        description: {
            type: SchemaTypes.String,
            default: "",
            maxlength: STORY_TYPE_DESCRIPTION_MAX,
            dynamicTableConfiguration: {
                sortable: false,
            },
        },
        sortOrder: {
            type: SchemaTypes.Number,
            required: false,
            default: 0,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.NUMBER,
            },
        },
    },
    {accessMode: "loose"}
);

ownershipPlugin(StoryTypeSchema);
auditPlugin(StoryTypeSchema);
softDeletePlugin(StoryTypeSchema);
lifeCyclePlugin(StoryTypeSchema);
applyStoryTypeIndexes(StoryTypeSchema);

const StoryType = model<IStoryType>("StoryType", StoryTypeSchema);
normalizeSchemaPermissions(StoryType);
export default StoryType;

addModelData(StoryType, storyTypeViews);
validateSchemaDefAgainstMongoose(StoryTypeSchema, StoryTypeSchemaDef, "StoryType", ["slug", "company"]);
