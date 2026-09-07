import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    LAND_PARCEL_LONG_TEXT_MAX,
    LAND_PARCEL_SHORT_TEXT_MAX,
    LandParcelSchemaDef,
    landParcelStatusValues,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/landParcel.schema-def";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSnippet} from "../edifice/edifice.snippets";
import {landParcelViews} from "./landParcel.views";
import {applyLandParcelIndexes} from "./landParcel.indexes";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {IProject} from "@propertyManagement/database/schemas/project/project";
import {IEdifice} from "@propertyManagement/database/schemas/edifice/edifice";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUser} from "@coreModule/database/schemas/user/user";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {Decimal128} from "mongodb";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface ILandParcel extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    project: IProject;
    edifice: IEdifice;
    title: string;
    cadastralReference: string;
    areaSqm: number;
    zoning: string;
    currency: ICurrency;
    acquisitionCost: Decimal128;
    dueDiligenceStatus: string;
    dueDiligenceNotes: string;
    dueDiligenceSteps: ILandParcelDueDiligenceStep[];
    acquisitionNotes: string;
    disposeNotes: string;
    description: string;
    notes: string;
    media: IMedia[];
    status?: string;
}

export interface ILandParcelDueDiligenceStep {
    _id?: any;
    title: string;
    notes?: string;
    performedBy?: IUser;
    performedAt: Date;
    media?: IMedia[];
}

const LandParcelSchema = new Schema<ILandParcel>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            maxlength: LAND_PARCEL_SHORT_TEXT_MAX,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        project: {
            type: SchemaTypes.ObjectId,
            ref: "Project",
            required: true,
            refAllowlist: ProjectSimpleSnippet
        },
        edifice: {
            type: SchemaTypes.ObjectId,
            ref: "Edifice",
            required: false,
            refAllowlist: EdificeSnippet
        },
        title: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: LAND_PARCEL_SHORT_TEXT_MAX
        },
        cadastralReference: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_SHORT_TEXT_MAX,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
        },
        areaSqm: {
            type: SchemaTypes.Number,
            required: false
        },
        zoning: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_SHORT_TEXT_MAX
        },
        currency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: false,
            refAllowlist: CurrencySimpleSnippet
        },
        acquisitionCost: {
            type: SchemaTypes.Decimal128,
            required: false
        },
        dueDiligenceStatus: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_SHORT_TEXT_MAX,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
        },
        dueDiligenceNotes: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_LONG_TEXT_MAX,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
        },
        dueDiligenceSteps: {
            type: [{
                title: {
                    type: SchemaTypes.String,
                    required: true,
                    maxlength: LAND_PARCEL_SHORT_TEXT_MAX,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
                notes: {
                    type: SchemaTypes.String,
                    required: false,
                    maxlength: LAND_PARCEL_LONG_TEXT_MAX,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
                performedBy: {
                    type: SchemaTypes.ObjectId,
                    ref: "User",
                    required: false,
                    refAllowlist: SimpleBlankUserSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
                performedAt: {
                    type: SchemaTypes.Date,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
                media: {
                    type: [{
                        type: SchemaTypes.ObjectId,
                        ref: "Media"
                    }],
                    default: [],
                    refAllowlist: MediaSimpleSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
            }],
            default: [],
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
        },
        acquisitionNotes: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_LONG_TEXT_MAX,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
        },
        disposeNotes: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_LONG_TEXT_MAX,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
        },
        description: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_LONG_TEXT_MAX
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            maxlength: LAND_PARCEL_LONG_TEXT_MAX
        },
        media: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet
        },
        status: {
            type: SchemaTypes.String,
            enum: [...landParcelStatusValues],
            required: false,
            default: "prospect",
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
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
lifeCyclePlugin(LandParcelSchema);
applyLandParcelIndexes(LandParcelSchema);

const LandParcel = model<ILandParcel>("LandParcel", LandParcelSchema, "landparcels");
export default LandParcel;

normalizeSchemaPermissions(LandParcel);
addModelData(LandParcel, landParcelViews);
validateSchemaDefAgainstMongoose(LandParcelSchema, LandParcelSchemaDef, "LandParcel", ["name", "status", "cadastralReference", "acquisitionNotes", "disposeNotes", "dueDiligenceStatus", "dueDiligenceNotes", "dueDiligenceSteps"]);
