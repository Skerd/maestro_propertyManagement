import * as crypto from "crypto";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {Decimal128} from "mongodb";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUnit} from "../unit/unit";
import {ILease} from "../lease/lease";
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
import {rentalPaymentViews} from "./rentalPayment.views";
import {applyRentalPaymentIndexes} from "./rentalPayment.indexes";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    RentalPaymentSchemaDef,
    RENTAL_PAYMENT_LONG_TEXT_MAX,
    RENTAL_PAYMENT_RECEIPT_MEDIA_MAX,
    RENTAL_PAYMENT_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {LeaseSimpleSnippet} from "../lease/lease.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";

export enum RentalPaymentStatus {
    PENDING        = "pending",
    PAID           = "paid",
    PARTIALLY_PAID = "partially_paid",
    OVERDUE        = "overdue",
    WAIVED         = "waived",
}

export interface IRentalPayment extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name?: string;
    lease: ILease;
    unit: IUnit;
    dueDate: Date;
    amount: Decimal128;
    currency: ICurrency;
    status: RentalPaymentStatus;
    paidDate?: Date;
    paidAmount?: Decimal128;
    remaining?: number;
    lateFeeAmount?: Decimal128;
    paymentReceipts?: {amount: Decimal128; paidDate: Date; notes?: string; media?: IMedia[]}[];
    notes?: string;
    receiptMedia?: IMedia;
    rentReminderEmailAt3d?: Date;
    rentReminderEmailAt1d?: Date;
    rentReminderEmailAt0d?: Date;
    rentOverdueNoticeEmailAt?: Date;
}

const RentalPaymentSchema = new Schema<IRentalPayment>(
    {
        name: {
            type:        SchemaTypes.String,
            trim:        true,
            immutable:   true,
            required:    false,
            maxlength:   RENTAL_PAYMENT_SHORT_TEXT_MAX,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
                filterable: true,
                sortable: true,
            },
        },
        lease: {
            type:         SchemaTypes.ObjectId,
            ref:          "Lease",
            required:     true,
            refAllowlist: LeaseSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
                filterable: true,
                sortable: true,
            },
        },
        unit: {
            type:         SchemaTypes.ObjectId,
            ref:          "Unit",
            required:     true,
            refAllowlist: UnitSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name", "unitNumber"],
                filterable: true,
                sortable: true,
            },
        },
        dueDate: {
            type: SchemaTypes.Date,
            required: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
                sortable: true,
            },
        },
        amount: {
            type: SchemaTypes.Decimal128,
            required: true,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: true,
                sortable: true,
            },
        },
        currency: {
            type:         SchemaTypes.ObjectId,
            ref:          "Currency",
            required:     true,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["symbol", "name"],
                filterable: true,
                sortable: true,
            },
        },
        status: {
            type:     SchemaTypes.String,
            required: true,
            enum:     Object.values(RentalPaymentStatus),
            default:  RentalPaymentStatus.PENDING,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.ENUM,
                filterable: true,
                sortable: true,
            },
        },
        paidDate: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
                sortable: true,
            },
        },
        paidAmount: {
            type: SchemaTypes.Decimal128,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: true,
                sortable: true,
            },
        },
        remaining: {
            type: SchemaTypes.Number,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: false,
                sortable: false,
                dtoPath: "remaining",
            },
        },
        lateFeeAmount: {
            type: SchemaTypes.Decimal128,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.NUMBER,
                filterable: true,
                sortable: true,
            },
        },
        paymentReceipts: {
            type: [{
                amount: {
                    type: SchemaTypes.Decimal128,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
                paidDate: {
                    type: SchemaTypes.Date,
                    required: true,
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
                    trim: true,
                    maxlength: RENTAL_PAYMENT_LONG_TEXT_MAX,
                    dynamicTableConfiguration: {
                        hideColumn: true,
                        filterable: false,
                        sortable: false,
                        visible: false,
                    },
                },
                media: {
                    type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
                    required: false,
                    default: [],
                    refAllowlist: MediaSimpleSnippet,
                    validate: {
                        validator: (v: unknown) => !Array.isArray(v) || v.length <= RENTAL_PAYMENT_RECEIPT_MEDIA_MAX,
                    },
                    dynamicTableConfiguration: {
                        cellType: COLUMN_TYPE.FILE,
                        filterable: true,
                        sortable: false,
                        dtoPath: "paymentReceiptsMedia",
                    },
                },
            }],
            required: false,
            default: [],
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            /** objectId cell → badges; label from each receipt via refDisplayKey. */
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["currency.symbol", "amount", "! · ", "paidDate"],
                maxInlineItems: 2,
                filterable: false,
                sortable: false,
            },
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: RENTAL_PAYMENT_LONG_TEXT_MAX,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.STRING,
                filterable: true,
                sortable: false,
            },
        },
        receiptMedia: {
            type:         SchemaTypes.ObjectId,
            ref:          "Media",
            required:     false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.FILE,
                sortable: false,
            },
        },
        rentReminderEmailAt3d: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
                sortable: true,
            },
        },
        rentReminderEmailAt1d: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
                sortable: true,
            },
        },
        rentReminderEmailAt0d: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
                sortable: true,
            },
        },
        rentOverdueNoticeEmailAt: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                filterable: true,
                sortable: true,
            },
        },
    },
    {accessMode: "loose"},
);

RentalPaymentSchema.pre("save", function (next) {
    if (!this.name) {
        const now  = new Date();
        const y    = now.getFullYear();
        const m    = String(now.getMonth() + 1).padStart(2, "0");
        const d    = String(now.getDate()).padStart(2, "0");
        const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name  = `RPAY-${y}${m}${d}-${rand}`;
    }
    next();
});

ownershipPlugin(RentalPaymentSchema);
auditPlugin(RentalPaymentSchema);
softDeletePlugin(RentalPaymentSchema);
lifeCyclePlugin(RentalPaymentSchema);
applyRentalPaymentIndexes(RentalPaymentSchema);

const RentalPayment = model<IRentalPayment>("RentalPayment", RentalPaymentSchema);
normalizeSchemaPermissions(RentalPayment);
export default RentalPayment;

addModelData(RentalPayment, rentalPaymentViews);
validateSchemaDefAgainstMongoose(RentalPaymentSchema, RentalPaymentSchemaDef, "RentalPayment", [
    // name: auto-generated; status/unit/paidDate: server or action-managed
    "name", "status", "paidDate", "unit",
    "paidAmount", "remaining", "lateFeeAmount", "paymentReceipts",
    "rentReminderEmailAt3d", "rentReminderEmailAt1d", "rentReminderEmailAt0d", "rentOverdueNoticeEmailAt",
]);
