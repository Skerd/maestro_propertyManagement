import * as crypto from "crypto";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {Decimal128} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
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
import {leaseViews} from "./lease.views";
import {applyLeaseIndexes} from "./lease.indexes";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    LeaseSchemaDef,
    LEASE_LONG_TEXT_MAX,
    LEASE_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.schema-def";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";

export enum LeaseStatus {
    ACTIVE     = "active",
    EXPIRED    = "expired",
    TERMINATED = "terminated",
}

export interface ILease extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name?: string;
    unit: IUnit;
    tenant: IUser;
    startDate: Date;
    endDate: Date;
    monthlyRent: Decimal128;
    rentCurrency: ICurrency;
    depositAmount?: Decimal128;
    lateFeePercentage?: number;
    gracePeriodDays?: number;
    depositPaid: boolean;
    depositReturnedAt?: Date;
    status: LeaseStatus;
    terminationDate?: Date;
    terminationReason?: string;
    notes?: string;
    contractMedia?: IMedia;
}

const LeaseSchema = new Schema<ILease>(
    {
        name: {
            type: SchemaTypes.String,
            trim: true,
            immutable: true,
            required: false,
            maxlength: LEASE_SHORT_TEXT_MAX,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
                filterable: true,
            },
        },
        unit: {
            type: SchemaTypes.ObjectId,
            ref: "Unit",
            required: true,
            refAllowlist: UnitSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
                filterable: true,
            },
        },
        tenant: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            refAllowlist: SimpleBlankUserSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name", "surname"],
                filterable: true,
            },
        },
        startDate: {
            type: SchemaTypes.Date,
            required: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
            },
        },
        endDate: {
            type: SchemaTypes.Date,
            required: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
            },
        },
        monthlyRent: {
            type: SchemaTypes.Decimal128,
            required: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: true,
            },
        },
        rentCurrency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: true,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
                filterable: true,
            },
        },
        depositAmount: {
            type: SchemaTypes.Decimal128,
            required: false,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: true,
            },
        },
        lateFeePercentage: {
            type: SchemaTypes.Number,
            required: false,
            default: 0,
            min: 0,
            max: 100,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: false,
            },
        },
        gracePeriodDays: {
            type: SchemaTypes.Number,
            required: false,
            default: 0,
            min: 0,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: false,
            },
        },
        depositPaid: {
            type: SchemaTypes.Boolean,
            required: true,
            default: false,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.BOOLEAN,
                filterable: true,
            },
        },
        depositReturnedAt: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
            },
        },
        status: {
            type:     SchemaTypes.String,
            required: true,
            enum:     Object.values(LeaseStatus),
            default:  LeaseStatus.ACTIVE,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.ENUM,
                filterable: true,
            },
        },
        terminationDate: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
            },
        },
        terminationReason: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: LEASE_LONG_TEXT_MAX,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
                filterable: false,
            },
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: LEASE_LONG_TEXT_MAX,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
                filterable: false,
            },
        },
        contractMedia: {
            type:         SchemaTypes.ObjectId,
            ref:          "Media",
            required:     false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false,
            },
        },
    },
    {accessMode: "loose"},
);

LeaseSchema.pre("save", function (next) {
    if (!this.name) {
        const now  = new Date();
        const y    = now.getFullYear();
        const m    = String(now.getMonth() + 1).padStart(2, "0");
        const d    = String(now.getDate()).padStart(2, "0");
        const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name  = `LEASE-${y}${m}${d}-${rand}`;
    }
    next();
});

ownershipPlugin(LeaseSchema);
auditPlugin(LeaseSchema);
softDeletePlugin(LeaseSchema);
lifeCyclePlugin(LeaseSchema);
applyLeaseIndexes(LeaseSchema);

const Lease = model<ILease>("Lease", LeaseSchema);
normalizeSchemaPermissions(Lease);
export default Lease;

addModelData(Lease, leaseViews);
// name is server-set; status/depositPaid are action-managed; terminationDate/depositReturnedAt are Mongoose-only
validateSchemaDefAgainstMongoose(LeaseSchema, LeaseSchemaDef, "Lease", [
    "name", "status", "depositPaid", "terminationDate", "depositReturnedAt",
]);
