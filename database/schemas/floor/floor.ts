import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {IEdifice} from "../edifice/edifice";
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
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {applyFloorIndexes} from "./floor.indexes";
import {floorViews} from "./floor.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {FloorSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/floor.schema-def";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IFloor extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    mainImage: IMedia,      // main floor image, used to hover over and select units
    imageGallery: IMedia[], // image gallery for the floor
    videoGallery: IMedia[], // video gallery for the floor
    mediaFiles?: IMedia[],  // generic file attachments (PDFs, documents, etc.)
    marketingBooklet?: IMedia, // single marketing booklet PDF
    name: string;
    levelNumber: number;        // e.g., "0" = ground floor, "1" = first floor, etc.
    totalUnits?: number;
    area: number;               // total floor area in square meters
    isAccessible: boolean;      // accessibility flag
    hasEmergencyExit: boolean;
    description?: string;
    sharedSpaces: string[];
    polygonCoordinates?: {x: number, y: number}[]; // Relative coordinates (0-1) for floor location on edifice main image

    edifice: IEdifice;
    project?: import("mongodb").ObjectId; // denormalized from edifice.project for fast dashboard queries
    company: ICompany
}

const FloorSchema = new Schema<IFloor>(
    {
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
                cellType: COLUMN_TYPE.AVATAR
                // visible: false,
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
                sortable: false,
                // visible: false,
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
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true
        },
        levelNumber: {
            type: SchemaTypes.Number,
            required: true
        },
        totalUnits: {
            type: SchemaTypes.Number,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        area: {
            type: SchemaTypes.Number,
            required: true
        },
        isAccessible: {
            type: SchemaTypes.Boolean,
            required: true,
            default: true
        },
        hasEmergencyExit: {
            type: SchemaTypes.Boolean,
            required: true,
            default: false
        },
        description: {
            type: SchemaTypes.String,
            required: false
        },
        sharedSpaces: {
            type: [SchemaTypes.String],
            default: [],
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
            }
        },
        polygonCoordinates: {
            type: [{
                x: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: 0,
                    max: 1,
                    dynamicTableConfiguration: {
                        filterable: false,
                        sortable: false,
                        hideColumn: true
                    }
                },
                y: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: 0,
                    max: 1,
                    dynamicTableConfiguration: {
                        filterable: false,
                        sortable: false,
                        hideColumn: true
                    }
                }
            }],
            required: false,
            default: undefined,
            validate: {
                validator: function(value: {x: number, y: number}[]) {
                    if (!value || value.length === 0) return true; // Optional field
                    return value.length >= 3; // Minimum 3 points for a polygon
                },
                message: 'Polygon coordinates must have at least 3 points'
            },
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false,
                sortable: false,
                visible: false,
            }
        },
        edifice: {
            type: SchemaTypes.ObjectId,
            ref: "Edifice",
            required: true,
            refAllowlist: EdificeSimpleSnippet
        },
        project: {
            // for faster dashboard queries
            type: SchemaTypes.ObjectId,
            ref: "Project",
            required: false,
            index: true,
            permissions: {
                self: { write: "no-permission" },
                others: { write: "no-permission" },
            },
        },
    },
    {
       accessMode: "loose"
    }
);

ownershipPlugin(FloorSchema);
auditPlugin(FloorSchema);
softDeletePlugin(FloorSchema);
lifeCyclePlugin(FloorSchema);
applyFloorIndexes(FloorSchema);
const Floor = model<IFloor>('Floor', FloorSchema);
normalizeSchemaPermissions(Floor);
export default Floor;

addModelData(Floor, floorViews);
validateSchemaDefAgainstMongoose(FloorSchema, FloorSchemaDef, "Floor", ["project"]);