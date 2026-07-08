import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {Decimal128} from 'mongodb';
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {addModelData} from "@coreModule/database/collections";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {applyProjectIndexes} from "./project.indexes";
import {projectViews} from "./project.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {ProjectSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/project.schema-def";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IProject extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;              
    description?: string;
    mainImage: IMedia, // main edifice image, used to hover over and select floors
    imageGallery: IMedia[], // image gallery for the edifice
    videoGallery: IMedia[], // video gallery for the edifice,
    mediaFiles?: IMedia[], // generic file attachments (PDFs, documents, etc.)
    marketingBooklet?: IMedia, // single marketing booklet PDF
    saleCommissionRatePercent?: Decimal128;
    reservationCommissionRatePercent?: Decimal128;
    company: ICompany
}

const ProjectSchema = new Schema<IProject>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: SchemaTypes.String,
            default: ''
        },
        saleCommissionRatePercent: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128 | null | undefined) => {
                if (v == null || v === '') return undefined;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128 | undefined) {
                    if (!value) return true;
                    const numValue = parseFloat(value.toString());
                    return numValue >= 0 && numValue <= 100;
                },
                message: 'Commission rate percent must be between 0 and 100'
            },
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.PERCENTAGE
            }
        },
        reservationCommissionRatePercent: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128 | null | undefined) => {
                if (v == null || v === '') return undefined;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128 | undefined) {
                    if (!value) return true;
                    const numValue = parseFloat(value.toString());
                    return numValue >= 0 && numValue <= 100;
                },
                message: 'Commission rate percent must be between 0 and 100'
            },
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.PERCENTAGE
            }
        },
        mainImage: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: true,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.AVATAR
            }
        },
        imageGallery: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                // visible: false,
                cellType: COLUMN_TYPE.AVATAR
            }
        },
        videoGallery: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                // cellType: COLUMN_TYPE.AVATAR
            }
        },
        mediaFiles: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                visible: false,
            }
        },
        marketingBooklet: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                visible: false,
            },
        },
    },
    {
        accessMode: "loose"
    }
);

ownershipPlugin(ProjectSchema);
auditPlugin(ProjectSchema);
softDeletePlugin(ProjectSchema);
lifeCyclePlugin(ProjectSchema);
applyProjectIndexes(ProjectSchema);

const Project = model<IProject>('Project', ProjectSchema);
export default Project;

normalizeSchemaPermissions(Project);
addModelData(Project, projectViews);
validateSchemaDefAgainstMongoose(ProjectSchema, ProjectSchemaDef, Project.modelName);