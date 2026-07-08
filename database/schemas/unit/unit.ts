import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {Decimal128} from "mongodb";
import {IFloor} from "../floor/floor";
import {IUnitType} from "../unitType/unitType";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
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
import {applyUnitIndexes} from "./unit.indexes";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {IInspection} from "../inspection/inspection";
import {IModificationRequest} from "../modificationRequest/modificationRequest";
import {IReservation} from "../reservation/reservation";
import {ISale} from "../sale/sale";
import type {IUnitCost} from "../unitCost/unitCost";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {addModelData} from "@coreModule/database/collections";
import {unitViews} from "./unit.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {UnitSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.schema-def";
import {
    UNIT_CONSTRUCTION_STATUS_VALUES,
    UNIT_ORIENTATION_VALUES,
    UnitConstructionStatus,
    UnitOrientation,
    UnitStatus
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {UnitTypeSimpleSnippet} from "../unitType/unitType.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {FloorSimpleSnippet} from "../floor/floor.snippets";
import {UnitSimpleSnippet} from "./unit.snippets";
import {InspectionSimpleSnippet} from "../inspection/inspection.snippets";
import {
    ModificationRequestSimpleSnippet
} from "../modificationRequest/modificationRequest.snippets";
import {ReservationBlankSnippet,} from "../reservation/reservation.snippets";
import {SaleBlankSnippet} from "../sale/sale.snippets";
import {UnitCostSimpleSnippet} from "../unitCost/unitCost.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IPriceHistoryEntry {
    price: Decimal128;
    currency: ICurrency;
    changedAt: Date;
    changedBy: import("mongodb").ObjectId;
    reason?: string;
}

export interface IUnit extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    unitType: IUnitType;
    unitNumber: string;
    name: string;
    area: number;
    sharedArea: number;
    netArea: number,
    verandaArea?: number,
    price: Decimal128;
    priceCurrency: ICurrency;
    hasBalcony: boolean;
    hasTerrace: boolean;
    hasSeaView: boolean;
    hasCityView: boolean;
    hasLakeView: boolean;
    hasElevator: boolean;

    numberOfRooms: number;
    numberOfBathrooms: number;
    description?: string;
    mainImage: IMedia;
    imageGallery: IMedia[];
    videoGallery: IMedia[];
    mediaFiles?: IMedia[];
    marketingBooklet?: IMedia; // single marketing booklet PDF
    polygonCoordinates?: {x: number, y: number}[]; // Relative coordinates (0-1) for unit location on floor main image

    status: UnitStatus,
    connectedUnits: IUnit[],
    inspections: IInspection[],
    modificationRequests: IModificationRequest[],
    costs: IUnitCost[],

    // Reservation reference (when status is RESERVED)
    reservation?: IReservation,

    // Sale reference (when status is SOLD)
    sale?: ISale,

    floor: IFloor;
    edifice?: import("mongodb").ObjectId; // denormalized from floor.edifice for fast dashboard queries
    project?: import("mongodb").ObjectId; // denormalized from floor.edifice.project for fast dashboard queries
    company: ICompany;
    orientation?: UnitOrientation;
    constructionStatus?: UnitConstructionStatus;
    saleCommissionRatePercent?: number;
    reservationCommissionRatePercent?: number;
    priceHistory?: IPriceHistoryEntry[];
}

const UnitSchema = new Schema<IUnit>(
    {
        unitType: {
            type: Schema.Types.ObjectId,
            ref: 'UnitType',
            required: true,
            refAllowlist: UnitTypeSimpleSnippet
        },
        unitNumber: {
            type: Schema.Types.String,
            required: true,
            trim: true
        },
        name: {
            type: Schema.Types.String,
            required: true,
            trim: true
        },
        area: {
            type: Schema.Types.Number,
            required: true
        },
        sharedArea: {
            type: Schema.Types.Number,
            required: true
        },
        netArea: {
            type: Schema.Types.Number,
            // required: true
        },
        verandaArea: {
            type: Schema.Types.Number,
            required: false,
            min: 0
        },
        price: {
            type: SchemaTypes.Decimal128,
            required: true,
            set: (v: number | string | Decimal128) => {
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128) {
                    if (!value) return false;
                    const numValue = parseFloat(value.toString());
                    return numValue >= 0;
                },
                message: 'Price must be non-negative'
            }
        },
        priceCurrency: {
            type: Schema.Types.ObjectId,
            ref: 'Currency',
            required: true,
            refAllowlist: CurrencySimpleSnippet
        },
        hasBalcony: {
            type: Schema.Types.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        hasTerrace: {
            type: Schema.Types.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        hasSeaView: {
            type: Schema.Types.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        hasCityView: {
            type: Schema.Types.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        hasLakeView: {
            type: Schema.Types.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        hasElevator: {
            type: Schema.Types.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        orientation: {
            type: SchemaTypes.String,
            enum: [...UNIT_ORIENTATION_VALUES],
            required: false,
            index: true,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        constructionStatus: {
            type: SchemaTypes.String,
            enum: [...UNIT_CONSTRUCTION_STATUS_VALUES],
            required: false,
            index: true,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        numberOfRooms: {
            type: Schema.Types.Number,
            required: true
        },
        numberOfBathrooms: {
            type: Schema.Types.Number,
            required: true
        },
        description: {
            type: Schema.Types.String,
            required: false,
            default: ''
        },
        mainImage: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.AVATAR
            },
            refAllowlist: MediaSimpleSnippet
        },
        imageGallery: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: "Media"
            }],
            required: false,
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                visible: false,
            }
        },
        videoGallery: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: "Media"
            }],
            required: false,
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                visible: false,
            }
        },
        mediaFiles: { type: [{ type: Schema.Types.ObjectId, ref: "Media" }], required: false, default: [], refAllowlist: MediaSimpleSnippet, dynamicTableConfiguration: { filterable: false, sortable: false, visible: false } },
        marketingBooklet: {
            type: Schema.Types.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                visible: false,
            },
        },
        polygonCoordinates: {
            type: [{
                x: {
                    type: Schema.Types.Number,
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
                    type: Schema.Types.Number,
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
                filterable: false,
                sortable: false,
                hideColumn: true,
                visible: false,
            }
        },
        status: {
            type: Schema.Types.String,
            enum: Object.values(UnitStatus),
            required: true,
            default: UnitStatus.AVAILABLE,
            index: true
        },
        connectedUnits: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: 'Unit'
            }],
            required: false,
            default: [],
            refAllowlist: UnitSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ['name'],
                hideColumn: true,
            }
        },
        inspections: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: 'Inspection'
            }],
            required: false,
            default: [],
            refAllowlist: InspectionSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ['name'],
                hideColumn: true,
            }
        },
        modificationRequests: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: 'ModificationRequest'
            }],
            required: false,
            default: [],
            refAllowlist: ModificationRequestSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ['name'],
                hideColumn: true
            }
        },
        costs: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: 'UnitCost'
            }],
            required: false,
            default: [],
            refAllowlist: UnitCostSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ['name'],
                hideColumn: true,
            }
        },
        reservation: {
            type: SchemaTypes.ObjectId,
            ref: 'Reservation',
            required: false,
            index: true,
            unique: true,
            sparse: true, // Allows multiple nulls but only one non-null value,
            refAllowlist: ReservationBlankSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ['name']
            }
        },
        sale: {
            type: SchemaTypes.ObjectId,
            ref: 'Sale',
            required: false,
            index: true,
            unique: true,
            sparse: true, // Allows multiple nulls but only one non-null value,
            refAllowlist: SaleBlankSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ['name']
            }
        },
        saleCommissionRatePercent: {
            type: Schema.Types.Number,
            required: false,
            min: 0,
            max: 100,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.PERCENTAGE,
            }
        },
        reservationCommissionRatePercent: {
            type: Schema.Types.Number,
            required: false,
            min: 0,
            max: 100,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.PERCENTAGE,
            }
        },
        priceHistory: {
            type: [{
                price: {
                    type: SchemaTypes.Decimal128,
                    required: true,
                    set: (v: number | string | Decimal128) => {
                        if (v instanceof Decimal128) return v;
                        return Decimal128.fromString(v.toString());
                    },
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        visible: false,
                        filterable: false,
                        sortable: false
                    }
                },
                currency: {
                    type: SchemaTypes.ObjectId,
                    ref: "Currency",
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        visible: false,
                        filterable: false,
                        sortable: false
                    }
                },
                changedAt: {
                    type: SchemaTypes.Date,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        visible: false,
                        filterable: false,
                        sortable: false
                    }
                },
                changedBy: {
                    type: SchemaTypes.ObjectId,
                    ref: "User",
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        visible: false,
                        filterable: false,
                        sortable: false
                    }
                },
                reason: {
                    type: SchemaTypes.String,
                    required: false,
                    trim: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        visible: false,
                        filterable: false,
                        sortable: false
                    }
                },
            }],
            required: false,
            default: [],
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
            dynamicTableConfiguration: {
                hideColumn: true,
                visible: false,
                filterable: false,
                sortable: false
            }
        },
        floor: {
            type: Schema.Types.ObjectId,
            ref: 'Floor',
            required: true,
            refAllowlist: FloorSimpleSnippet
        },
        edifice: {
            type: Schema.Types.ObjectId,
            ref: "Edifice",
            required: false,
            permissions: {
                self: { write: "no-permission" },
                others: { write: "no-permission" },
            },
        },
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: false,
            permissions: {
                self: { write: "no-permission" },
                others: { write: "no-permission" },
            },
        },
    },
    {
        accessMode: "loose",
    }
);

// Pre-save middleware to handle status transitions and validation
UnitSchema.pre('save', function(next) {
    const unit = this as unknown as IUnit;

    if (unit.isModified('status')) {
        // Validate reservation reference when status is RESERVED
        if (unit.status === UnitStatus.RESERVED) {
            if (!unit.reservation) {
                return next(new Error('Reservation reference is required when status is RESERVED'));
            }
        }

        // Validate sale reference when status is SOLD
        if (unit.status === UnitStatus.SOLD) {
            if (!unit.sale) {
                return next(new Error('Sale reference is required when status is SOLD'));
            }
        }

        // Clear reservation/sale references when status changes away from RESERVED/SOLD
        if (unit.status === UnitStatus.AVAILABLE || unit.status === UnitStatus.UNAVAILABLE) {
            if (unit.reservation) {
                unit.reservation = undefined;
            }
            if (unit.sale) {
                unit.sale = undefined;
            }
        }

        // Clear sale reference when status changes to RESERVED
        if (unit.status === UnitStatus.RESERVED) {
            if (unit.sale) {
                unit.sale = undefined;
            }
        }

    }

    next();
});

ownershipPlugin(UnitSchema);
auditPlugin(UnitSchema);
softDeletePlugin(UnitSchema);
lifeCyclePlugin(UnitSchema);
applyUnitIndexes(UnitSchema);
// Define getter for price field after schema creation (fixes TypeScript compatibility)
UnitSchema.path('price').get(function(v: Decimal128) {
    return v ? parseFloat(v.toString()) : null;
});

const Unit = model<IUnit>('Unit', UnitSchema);
normalizeSchemaPermissions(Unit);
export default Unit;
export {UnitStatus, UnitConstructionStatus, UnitOrientation, UNIT_CONSTRUCTION_STATUS_VALUES, UNIT_ORIENTATION_VALUES};

addModelData(Unit, unitViews);
// status is required in Mongoose but system-managed (set via pre-save hook) — not a form field
validateSchemaDefAgainstMongoose(UnitSchema, UnitSchemaDef, "Unit", ["status", "priceHistory", "edifice", "project"]);