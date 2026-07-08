import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {Decimal128, ObjectId} from "mongodb";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {applyPaymentPlanIndexes} from "./paymentPlan.indexes";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {addModelData} from "@coreModule/database/collections";
import {paymentPlanViews} from "./paymentPlan.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {PaymentPlanSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/paymentPlan.schema-def";
import {SaleBlankSnippet} from "../sale/sale.snippets";
import dayjs from "dayjs";
import crypto from "crypto";
import {SalePaymentType} from "../sale/sale";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

/**
 * Payment plan installment status
 */
export enum InstallmentStatus {
    PENDING = "pending",
    PAID = "paid",
    OVERDUE = "overdue",
    CANCELLED = "cancelled",
    PARTIALLY_PAID = "partially_paid"
}

/**
 * Payment plan status
 */
export enum PaymentPlanStatus {
    ACTIVE = "active",
    COMPLETED = "completed",
    DEFAULTED = "defaulted",
    CANCELLED = "cancelled"
}

/**
 * Payment plan installment
 */
export interface IPaymentPlanInstallment {
    installmentNumber: number;       // Installment number (1, 2, 3, etc.)
    dueDate: Date;                   // When payment is due
    amount: Decimal128;              // Amount due for this installment
    principalAmount: Decimal128;     // Principal portion
    interestAmount: Decimal128;      // Interest portion (if applicable)
    status: InstallmentStatus;       // Payment status
    paidAmount?: Decimal128;         // Amount paid (for partial payments)
    paidDate?: Date;                 // When payment was made
    transactionId?: string;          // Reference to payment transaction
    notes?: string;                  // Notes about this installment
    installmentReminderEmailAt3d?: Date;
    installmentReminderEmailAt1d?: Date;
    installmentReminderEmailAt0d?: Date;
    installmentOverdueNoticeEmailAt?: Date;
    lateFeeAmount?: Decimal128;
    paymentReceipts?: { amount: Decimal128; paidDate: Date; transactionId?: string; notes?: string }[];
}

export interface IRestructureHistoryEntry {
    restructuredAt: Date;
    restructuredBy: ObjectId;
    reason?: string;
    previousInstallments: IPaymentPlanInstallment[];
    previousNumberOfInstallments: number;
    previousStartDate: Date;
    previousEndDate: Date;
    previousInterestRate?: number;
}

/**
 * Payment plan model
 * Tracks payment plans for unit sales
 */
export interface IPaymentPlan extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name?: string;                   // Unique code (e.g. PP-YYYYMMDD-XXXXXXXX), auto-generated on create
    sale: ObjectId;                  // Reference to the sale (ISale)
    status: PaymentPlanStatus;       // Overall plan status
    totalAmount: Decimal128;         // Total amount to be paid
    downPayment: Decimal128;         // Initial down payment amount
    downPaymentPaid: Boolean;        // if down payment has been fully paid
    downPaymentDate?: Date;          // When down payment was made
    remainingBalance: Decimal128;    // Remaining balance to be paid
    numberOfInstallments: number;    // Total number of installments
    installmentAmount: Decimal128;   // Amount per installment
    interestRate?: number;           // Annual interest rate (if applicable)
    startDate: Date;                 // When payment plan starts
    endDate: Date;                   // Expected completion date
    installments: IPaymentPlanInstallment[]; // List of all installments
    gracePeriodDays?: number;       // Grace period for late payments (in days)
    lateFeePercentage?: number;      // Late fee percentage (if applicable)
    notes?: string;                  // General notes about the payment plan
    restructureHistory?: IRestructureHistoryEntry[];
}

/** Still owed: full contract minus installment payments; minus down payment only when `downPaymentPaid` is true. */
export function computePaymentPlanRemainingBalance(plan: {
    totalAmount: unknown;
    downPayment: unknown;
    downPaymentPaid: boolean;
    installments?: Array<{paidAmount?: unknown}>;
} & any): number {
    const totalAmount =
        typeof plan.totalAmount === "object" && plan.totalAmount !== null && "toString" in plan.totalAmount
            ? parseFloat((plan.totalAmount as Decimal128).toString())
            : typeof plan.totalAmount === "number"
              ? plan.totalAmount
              : parseFloat(String(plan.totalAmount ?? 0));
    const downPaymentAmount =
        typeof plan.downPayment === "object" && plan.downPayment !== null && "toString" in plan.downPayment
            ? parseFloat((plan.downPayment as Decimal128).toString())
            : typeof plan.downPayment === "number"
              ? plan.downPayment
              : parseFloat(String(plan.downPayment ?? 0));
    const totalPaid = (plan.installments ?? []).reduce((sum: number, inst: {paidAmount?: unknown}) => {
        const raw = inst.paidAmount;
        const paid = raw
            ? typeof raw === "object" && raw !== null && "toString" in raw
                ? parseFloat((raw as Decimal128).toString())
                : typeof raw === "number"
                  ? raw
                  : parseFloat(String(raw))
            : 0;
        return sum + paid;
    }, 0);
    const downContribution = plan.downPaymentPaid ? downPaymentAmount : 0;
    return Math.max(0, totalAmount - downContribution - totalPaid);
}

const PaymentPlanSchema = new Schema<IPaymentPlan>(
    {
        name: {
            type: SchemaTypes.String,
            trim: true,
            immutable: true,
            required: false,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        sale: {
            type: SchemaTypes.ObjectId,
            ref: 'Sale',
            required: true,
            index: true,
            unique: true, // One payment plan per sale
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
            refAllowlist: SaleBlankSnippet
        },
        status: {
            type: SchemaTypes.String,
            enum: Object.values(PaymentPlanStatus),
            required: true,
            default: PaymentPlanStatus.ACTIVE,
            index: true
        },
        totalAmount: {
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
                message: 'Total amount must be non-negative'
            }
        },
        downPayment: {
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
                message: 'Down payment must be non-negative'
            }
        },
        downPaymentPaid: {
            type: SchemaTypes.Boolean,
            required: true,
        },
        downPaymentDate: {
            type: SchemaTypes.Date,
            required: false
        },
        remainingBalance: {
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
                message: 'Remaining balance must be non-negative'
            },
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        numberOfInstallments: {
            type: SchemaTypes.Number,
            required: true,
            min: [1, 'Number of installments must be at least 1']
        },
        installmentAmount: {
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
                message: 'Installment amount must be non-negative'
            }
        },
        interestRate: {
            type: SchemaTypes.Number,
            required: false,
            min: [0, 'Interest rate must be non-negative'],
            max: [100, 'Interest rate cannot exceed 100%']
        },
        startDate: {
            type: SchemaTypes.Date,
            required: true,
            index: true
        },
        endDate: {
            type: SchemaTypes.Date,
            required: true,
            index: true
        },
        installments: {
            type: [{
                installmentNumber: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: [1, 'Installment number must be at least 1']
                },
                dueDate: {
                    type: SchemaTypes.Date,
                    required: true
                },
                amount: {
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
                        message: 'Installment amount must be non-negative'
                    }
                },
                principalAmount: {
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
                        message: 'Principal amount must be non-negative'
                    }
                },
                interestAmount: {
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
                        message: 'Interest amount must be non-negative'
                    }
                },
                status: {
                    type: SchemaTypes.String,
                    enum: Object.values(InstallmentStatus),
                    required: true,
                    default: InstallmentStatus.PENDING
                },
                paidAmount: {
                    type: SchemaTypes.Decimal128,
                    required: false,
                    set: (v: number | string | Decimal128) => {
                        if (v instanceof Decimal128) return v;
                        return Decimal128.fromString(v.toString());
                    },
                    validate: {
                        validator: function(value: Decimal128 | undefined) {
                            if (!value) return true;
                            const numValue = parseFloat(value.toString());
                            return numValue >= 0;
                        },
                        message: 'Paid amount must be non-negative'
                    }
                },
                paidDate: {
                    type: SchemaTypes.Date,
                    required: false
                },
                transactionId: {
                    type: SchemaTypes.String,
                    required: false,
                    trim: true
                },
                notes: {
                    type: SchemaTypes.String,
                    required: false,
                    trim: true
                },
                installmentReminderEmailAt3d: {
                    type: SchemaTypes.Date,
                    required: false,
                    permissions: {
                        self: {write: "no-permission"},
                        others: {write: "no-permission"},
                    },
                },
                installmentReminderEmailAt1d: {
                    type: SchemaTypes.Date,
                    required: false,
                    permissions: {
                        self: {write: "no-permission"},
                        others: {write: "no-permission"},
                    },
                },
                installmentReminderEmailAt0d: {
                    type: SchemaTypes.Date,
                    required: false,
                    permissions: {
                        self: {write: "no-permission"},
                        others: {write: "no-permission"},
                    },
                },
                installmentOverdueNoticeEmailAt: {
                    type: SchemaTypes.Date,
                    required: false,
                    permissions: {
                        self: {write: "no-permission"},
                        others: {write: "no-permission"},
                    },
                },
                lateFeeAmount: {
                    type: SchemaTypes.Decimal128,
                    required: false,
                    set: (v: number | string | Decimal128) => {
                        if (v instanceof Decimal128) return v;
                        return Decimal128.fromString(v.toString());
                    },
                    validate: {
                        validator: function(value: Decimal128 | undefined) {
                            if (!value) return true;
                            return parseFloat(value.toString()) >= 0;
                        },
                        message: 'Late fee amount must be non-negative'
                    },
                    permissions: {
                        self: {write: "no-permission"},
                        others: {write: "no-permission"},
                    },
                },
                paymentReceipts: {
                    type: [{
                        amount: {
                            type: SchemaTypes.Decimal128,
                            required: true,
                            set: (v: number | string | Decimal128) => {
                                if (v instanceof Decimal128) return v;
                                return Decimal128.fromString(v.toString());
                            },
                        },
                        paidDate: {type: SchemaTypes.Date, required: true},
                        transactionId: {type: SchemaTypes.String, required: false, trim: true},
                        notes: {type: SchemaTypes.String, required: false, trim: true},
                    }],
                    required: false,
                    default: [],
                    permissions: {
                        self: {write: "no-permission"},
                        others: {write: "no-permission"},
                    },
                },
            }],
            required: true,
            default: []
        },
        gracePeriodDays: {
            type: SchemaTypes.Number,
            required: false,
            min: [0, 'Grace period must be non-negative'],
            default: 0
        },
        lateFeePercentage: {
            type: SchemaTypes.Number,
            required: false,
            min: [0, 'Late fee percentage must be non-negative'],
            max: [100, 'Late fee percentage cannot exceed 100%']
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true
        },
        restructureHistory: {
            type: [{
                restructuredAt:              {type: SchemaTypes.Date,     required: true},
                restructuredBy:              {type: SchemaTypes.ObjectId, required: true},
                reason:                      {type: SchemaTypes.String,   required: false, trim: true},
                previousNumberOfInstallments:{type: SchemaTypes.Number,   required: true},
                previousStartDate:           {type: SchemaTypes.Date,     required: true},
                previousEndDate:             {type: SchemaTypes.Date,     required: true},
                previousInterestRate:        {type: SchemaTypes.Number,   required: false},
                previousInstallments:        {type: SchemaTypes.Mixed,    required: true},
            }],
            required: false,
            default: undefined,
            permissions: {
                self:   {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
    },
    {
        accessMode: "loose",
        permissions: {
            self: {
                delete: "no-permission",
                create: "no-permission",
                restore: "no-permission",
            },
            others: {
                delete: "no-permission",
                create: "no-permission",
                restore: "no-permission",
            }
        }
    }
);

// Pre-save middleware
PaymentPlanSchema.pre('save', function(next) {
    const plan = this as unknown as IPaymentPlan;

    if (plan.isNew && !plan.name) {
        const date = plan.startDate ? new Date(plan.startDate) : new Date();
        const datePart = dayjs(date).format('YYYYMMDD');
        const randomPart = crypto.randomBytes(4).toString('hex');
        plan.name = `PAYMENTS_SALE-${datePart}-${randomPart}`.toUpperCase();
    }

    // Validate installments count matches numberOfInstallments
    if (plan.installments.length !== plan.numberOfInstallments) {
        return next(new Error(`Number of installments (${plan.installments.length}) must match numberOfInstallments (${plan.numberOfInstallments})`));
    }

    const rb = computePaymentPlanRemainingBalance({
        totalAmount: plan.totalAmount,
        downPayment: plan.downPayment,
        downPaymentPaid: !!plan.downPaymentPaid,
        installments: plan.installments ?? [],
    });
    plan.remainingBalance = Decimal128.fromString(rb.toString());
    
    // Auto-update status when installments/down payment state changes.
    if (plan.isModified('installments') || plan.isModified('downPaymentPaid')) {
        const allPaid = plan.installments.every(inst => inst.status === InstallmentStatus.PAID);
        const hasOverdue = plan.installments.some(inst => 
            inst.status === InstallmentStatus.OVERDUE && 
            new Date(inst.dueDate) < new Date()
        );

        const canBeCompleted = allPaid && plan.downPaymentPaid === true;

        if (canBeCompleted && plan.status !== PaymentPlanStatus.COMPLETED) {
            plan.status = PaymentPlanStatus.COMPLETED;
        } else if (!canBeCompleted && plan.status === PaymentPlanStatus.COMPLETED) {
            plan.status = hasOverdue ? PaymentPlanStatus.DEFAULTED : PaymentPlanStatus.ACTIVE;
        } else if (hasOverdue && plan.status === PaymentPlanStatus.ACTIVE) {
            plan.status = PaymentPlanStatus.DEFAULTED;
        }
    }
    
    next();
});

ownershipPlugin(PaymentPlanSchema);
auditPlugin(PaymentPlanSchema);
softDeletePlugin(PaymentPlanSchema);
lifeCyclePlugin(PaymentPlanSchema);
applyPaymentPlanIndexes(PaymentPlanSchema);
const PaymentPlan = model<IPaymentPlan>('PaymentPlan', PaymentPlanSchema);
normalizeSchemaPermissions(PaymentPlan);
export default PaymentPlan;

addModelData(PaymentPlan, paymentPlanViews);
// startDate/endDate are required Dates with no schemaDefBuilder equivalent;
// installments is a required embedded array with Date/Decimal128 sub-fields
validateSchemaDefAgainstMongoose(PaymentPlanSchema, PaymentPlanSchemaDef, "PaymentPlan", [
    "startDate",
    "endDate",
    "installments",
    "restructureHistory",
]);