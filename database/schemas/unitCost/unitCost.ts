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
import {
    EXPENDITURE_CATEGORY_VALUES,
    MEASURE_UNIT_VALUES,
    UNIT_COST_PAYMENT_STATUS_VALUES,
    UNIT_COST_VERIFICATION_STATUS_VALUES,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.constants";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

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
    invoiceMedia: IMedia[];
    expenditureItems: IExpenditureItem[];
    budgetedAmount?: Decimal128;
    budgetCurrency?: ICurrency;
}

const expenditureItemSchema = new Schema<IExpenditureItem>(
    {
        title: {type: SchemaTypes.String, required: true, trim: true},
        category: {
            type: SchemaTypes.String,
            enum: [...EXPENDITURE_CATEGORY_VALUES],
            required: true,
        },
        amount: {
            type: SchemaTypes.Number,
            required: true,
            min: 0,
        },
        unit: {
            type: SchemaTypes.String,
            enum: [...MEASURE_UNIT_VALUES],
            required: true,
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
        },
        media: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
        },
    },
    {_id: true},
);

const UnitCostSchema = new Schema<IUnitCost>(
    {
        name: {
            type: SchemaTypes.String,
            trim: true,
            immutable: true,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        project: {
            type: SchemaTypes.ObjectId,
            ref: "Project",
            required: false,
            index: true,
            refAllowlist: ProjectSimpleSnippet,
        },
        edifice: {
            type: SchemaTypes.ObjectId,
            ref: "Edifice",
            required: false,
            index: true,
            refAllowlist: EdificeSimpleSnippet,
        },
        floor: {
            type: SchemaTypes.ObjectId,
            ref: "Floor",
            required: false,
            index: true,
            refAllowlist: FloorSimpleSnippet,
        },
        unit: {
            type: SchemaTypes.ObjectId,
            ref: "Unit",
            required: false,
            index: true,
            refAllowlist: UnitSnippet,
        },
        purchasePerson: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            index: true,
            refAllowlist: SimpleBlankUserSnippet,
        },
        purchaseDate: {
            type: SchemaTypes.Date,
            required: true,
            index: true,
        },
        paymentDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
        },
        verificationStatus: {
            type: SchemaTypes.String,
            enum: [...UNIT_COST_VERIFICATION_STATUS_VALUES],
            required: true,
            default: "pending_verification",
            index: true,
        },
        paymentStatus: {
            type: SchemaTypes.String,
            enum: [...UNIT_COST_PAYMENT_STATUS_VALUES],
            required: true,
            default: "unpaid",
            index: true,
        },
        tag: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            lowercase: true,
        },
        currency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: true,
            refAllowlist: CurrencySimpleSnippet,
        },
        invoiceNumber: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
        },
        vendorName: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
        },
        relatedModificationRequest: {
            type: SchemaTypes.ObjectId,
            ref: "ModificationRequest",
            required: false,
            refAllowlist: ModificationRequestSimpleSnippet,
        },
        invoiceMedia: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {hideColumn: true},
        },
        expenditureItems: {
            type: [expenditureItemSchema],
            default: [],
            dynamicTableConfiguration: {
                hideColumn: true,
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
        },
        budgetCurrency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: false,
            refAllowlist: CurrencySimpleSnippet,
        },
    },
    {
        accessMode: "loose",
    },
);

UnitCostSchema.pre("validate", function (next) {
    const doc = this as IUnitCost;
    const hasScope = !!(doc.unit || doc.floor || doc.edifice || doc.project);
    if (!hasScope) {
        this.invalidate(
            "unit",
            "At least one of unit, floor, edifice, or project must be set",
        );
    }
    next();
});

UnitCostSchema.pre("save", function (next) {
    const doc = this as IUnitCost;
    if (doc.isNew && !doc.name) {
        const datePart = dayjs(doc.purchaseDate || new Date()).format("YYYYMMDD");
        const randomPart = crypto.randomBytes(4).toString("hex");
        doc.name = `COST-${datePart}-${randomPart}`.toUpperCase();
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
// purchaseDate: date type has no schemaDefBuilder equivalent
// budgetedAmount: stored as Decimal128 but SchemaDef declares it as number
validateSchemaDefAgainstMongoose(UnitCostSchema, UnitCostSchemaDef, "UnitCost");
