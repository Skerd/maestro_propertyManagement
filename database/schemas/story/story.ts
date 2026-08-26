import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IProject} from "../project/project";
import {IEdifice} from "../edifice/edifice";
import {IUnit} from "../unit/unit";
import type {IStoryType} from "../storyType/storyType";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    StorySchemaDef,
    STORY_CONTENT_MAX,
    STORY_EXCERPT_MAX,
    STORY_TITLE_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/story.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {StoryTypeSimpleSnippet} from "../storyType/storyType.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {storyViews} from "./story.views";
import {applyStoryIndexes} from "./story.indexes";

export interface IStory extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    storyType: IStoryType;
    edifice?: IEdifice;
    unit?: IUnit;
    title: string;
    content: string;
    excerpt?: string;
    mainImage?: IMedia;
    imageGallery: IMedia[];
    videoGallery: IMedia[];
    published: boolean;
    publishedAt?: Date;
    sortOrder: number;
}

const StorySchema = new Schema<IStory>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        project: {
            type: SchemaTypes.ObjectId,
            ref: "Project",
            required: true,
            refAllowlist: ProjectSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        storyType: {
            type: SchemaTypes.ObjectId,
            ref: "StoryType",
            required: true,
            refAllowlist: StoryTypeSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        edifice: {
            type: SchemaTypes.ObjectId,
            ref: "Edifice",
            required: false,
            refAllowlist: EdificeSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        unit: {
            type: SchemaTypes.ObjectId,
            ref: "Unit",
            required: false,
            refAllowlist: UnitSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        title: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: STORY_TITLE_MAX,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        content: {
            type: SchemaTypes.String,
            required: true,
            minlength: 1,
            maxlength: STORY_CONTENT_MAX,
            dynamicTableConfiguration: {
                sortable: false,
            },
        },
        excerpt: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: STORY_EXCERPT_MAX,
            dynamicTableConfiguration: {
                sortable: false,
            },
        },
        mainImage: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.AVATAR,
            },
        },
        imageGallery: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
            },
        },
        videoGallery: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
            },
        },
        published: {
            type: SchemaTypes.Boolean,
            required: false,
            default: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.BOOLEAN,
            },
        },
        publishedAt: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.DATE,
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

StorySchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `STORY-${date}-${suffix}`;
    }
    if (this.published && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    next();
});

ownershipPlugin(StorySchema);
auditPlugin(StorySchema);
softDeletePlugin(StorySchema);
lifeCyclePlugin(StorySchema);
applyStoryIndexes(StorySchema);

const Story = model<IStory>("Story", StorySchema, "stories");
export default Story;

normalizeSchemaPermissions(Story);

addModelData(Story, storyViews);
validateSchemaDefAgainstMongoose(StorySchema, StorySchemaDef, "Story", ["name"]);
