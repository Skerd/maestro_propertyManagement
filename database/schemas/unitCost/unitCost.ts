import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {Decimal128} from "mongodb";
import {IUnit} from "../unit/unit";
import {IProject} from "../project/project";
import {IEdifice} from "../edifice/edifice";
import {IFloor} from "../floor/floor";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUser} from "@coreModule/database/schemas/user/user";
import {IModificationRequest} from "../modificationRequest/modificationRequest";
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
import {unitCostViews} from "./unitCost.views";
import {applyUnitCostIndexes} from "./unitCost.indexes";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {UnitCostSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.schema-def";
import {UnitSnippet} from "../unit/unit.snippets";
import {ProjectSimpleSnippet} from "../project/project.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {FloorSimpleSnippet} from "../floor/floor.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {ModificationRequestSimpleSnippet} from "../modificationRequest/modificationRequest.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {BoqItemSimpleSnippet} from "../boqItem/boqItem.snippets";
import {CostCommitmentSimpleSnippet} from "../costCommitment/costCommitment.snippets";
import {
    EXPENDITURE_CATEGORY_VALUES,
    MEASURE_UNIT_VALUES,
    UNIT_COST_PAYMENT_STATUS_VALUES,
    UNIT_COST_VERIFICATION_STATUS_VALUES,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.constants";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";

export type IExpenditureItem = {
    title: string;
    category: (typeof EXPENDITURE_CATEGORY_VALUES)[number];
    amount: number;
    unit: (typeof MEASURE_UNIT_VALUES)[number];
    pricePerUnit: Decimal128;
    media: IMedia[];
};

export interface IUnitCost extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    /** Narrowest placement; optional when the cost applies to floor/edifice/project only. */
    unit?: IUnit;
    floor?: IFloor;
    edifice?: IEdifice;
    project?: IProject;
    purchasePerson: IUser;
    purchaseDate: Date;
    paymentDate?: Date;
    notes?: string;
    verificationStatus: (typeof UNIT_COST_VERIFICATION_STATUS_VALUES)[number];
    paymentStatus: (typeof UNIT_COST_PAYMENT_STATUS_VALUES)[number];
    tag?: string;
    currency: ICurrency;
    invoiceNumber?: string;
    vendorName?: string;
    relatedModificationRequest?: IModificationRequest;
    /** Named "constructorRef", not "constructor" — see schema comment below. */
    constructorRef?: any;
    boqItem?: any;
    costCommitment?: any;
    invoiceMedia: IMedia[];
    expenditureItems: IExpenditureItem[];
    budgetedAmount?: Decimal128;
}

const UnitCostSchema: Schema = new Schema<IUnitCost>(
    {
        name: {
            type: SchemaTypes.String,
            trim: true,
            immutable: true,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
            },
        },
        project: {
            type: SchemaTypes.ObjectId,
            ref: "Project",
            required: false,
            index: true,
            refAllowlist: ProjectSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        edifice: {
            type: SchemaTypes.ObjectId,
            ref: "Edifice",
            required: false,
            index: true,
            refAllowlist: EdificeSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        floor: {
            type: SchemaTypes.ObjectId,
            ref: "Floor",
            required: false,
            index: true,
            refAllowlist: FloorSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        unit: {
            type: SchemaTypes.ObjectId,
            ref: "Unit",
            required: false,
            index: true,
            refAllowlist: UnitSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        purchasePerson: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            index: true,
            refAllowlist: SimpleBlankUserSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name", "surname"],
            },
        },
        purchaseDate: {
            type: SchemaTypes.Date,
            required: true,
            index: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
            },
        },
        paymentDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
            },
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
            },
        },
        verificationStatus: {
            type: SchemaTypes.String,
            enum: [...UNIT_COST_VERIFICATION_STATUS_VALUES],
            required: true,
            default: "pending_verification",
            index: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.ENUM,
            },
        },
        paymentStatus: {
            type: SchemaTypes.String,
            enum: [...UNIT_COST_PAYMENT_STATUS_VALUES],
            required: true,
            default: "unpaid",
            index: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.ENUM,
            },
        },
        tag: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            lowercase: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
            },
        },
        currency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: true,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        invoiceNumber: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
            },
        },
        vendorName: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
            },
        },
        relatedModificationRequest: {
            type: SchemaTypes.ObjectId,
            ref: "ModificationRequest",
            required: false,
            refAllowlist: ModificationRequestSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        // NOTE: named "constructorRef" — Mongoose silently drops any schema path literally
        // named "constructor" (plain-object prototype collision with Object.prototype.constructor).
        constructorRef: {
            type: SchemaTypes.ObjectId,
            ref: "Constructor",
            required: false,
            refAllowlist: ConstructorSimpleSnippet,
            dynamicTableConfiguration: {
                order: 16,
                defaultVisible: false,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        boqItem: {
            type: SchemaTypes.ObjectId,
            ref: "BoqItem",
            required: false,
            refAllowlist: BoqItemSimpleSnippet,
            dynamicTableConfiguration: {
                order: 17,
                defaultVisible: false,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        costCommitment: {
            type: SchemaTypes.ObjectId,
            ref: "CostCommitment",
            required: false,
            refAllowlist: CostCommitmentSimpleSnippet,
            dynamicTableConfiguration: {
                order: 18,
                defaultVisible: false,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        invoiceMedia: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {hideColumn: true},
        },
        expenditureItems: {
            type: [{
                title: {
                    type: SchemaTypes.String,
                    required: true,
                    trim: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                    },
                },
                category: {
                    type: SchemaTypes.String,
                    enum: [...EXPENDITURE_CATEGORY_VALUES],
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                    },
                },
                amount: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: 0,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                    },
                },
                unit: {
                    type: SchemaTypes.String,
                    enum: [...MEASURE_UNIT_VALUES],
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                    },
                },
                pricePerUnit: {
                    type: SchemaTypes.Decimal128,
                    required: true,
                    set: (v: number | string | Decimal128) => {
                        if (v instanceof Decimal128) return v;
                        return Decimal128.fromString(String(v));
                    },
                    validate: {
                        validator: function (value: Decimal128) {
                            if (!value) return false;
                            const numValue = parseFloat(value.toString());
                            return numValue >= 0;
                        },
                        message: "pricePerUnit must be non-negative",
                    },
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                    },
                },
                media: {
                    type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
                    default: [],
                    refAllowlist: MediaSimpleSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                    },
                },
            }],
            default: [],
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false,
                sortable: false,
            },
        },
        budgetedAmount: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128) => {
                if (v == null) return v;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(String(v));
            },
            validate: {
                validator: function (value: Decimal128 | null | undefined) {
                    if (value == null) return true;
                    return parseFloat(value.toString()) >= 0;
                },
                message: "budgetedAmount must be non-negative",
            },
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
            },
        },
    },
    {
        accessMode: "loose",
    },
);

UnitCostSchema.pre("validate", function (next) {
    const hasScope = !!(this.unit || this.floor || this.edifice || this.project);
    if (!hasScope) {
        this.invalidate(
            "unit",
            "At least one of unit, floor, edifice, or project must be set",
        );
    }
    next();
});

UnitCostSchema.pre("save", function (next) {
    if (this.isNew && !this.name) {
        const datePart = dayjs(this.purchaseDate || new Date()).format("YYYYMMDD");
        const randomPart = crypto.randomBytes(4).toString("hex");
        this.name = `COST-${datePart}-${randomPart}`.toUpperCase();
    }
    next();
});

UnitCostSchema.path("budgetedAmount").get(function (v: Decimal128) {
    return v ? parseFloat(v.toString()) : undefined;
});

ownershipPlugin(UnitCostSchema);
auditPlugin(UnitCostSchema);
softDeletePlugin(UnitCostSchema);
lifeCyclePlugin(UnitCostSchema);
applyUnitCostIndexes(UnitCostSchema);
const UnitCost = model<IUnitCost>("UnitCost", UnitCostSchema);
normalizeSchemaPermissions(UnitCost);
export default UnitCost;

addModelData(UnitCost, unitCostViews);
validateSchemaDefAgainstMongoose(UnitCostSchema, UnitCostSchemaDef, "UnitCost");
