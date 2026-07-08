import * as crypto from 'crypto';
import dayjs from 'dayjs';
import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {Decimal128} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUnit} from "../unit/unit";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {applySaleIndexes} from "./sale.indexes";
import {IApprovalStage, getApprovalStageSchemaDefinition} from "../modificationRequest/modificationRequest";
import {IPaymentPlan} from "../paymentPlan/paymentPlan";
import {IReservation} from "../reservation/reservation";
import {addModelData} from "@coreModule/database/collections";
import {saleViews} from "./sale.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {SaleSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.schema-def";
import {UnitSnippet} from "../unit/unit.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {ReservationSnippet} from "../reservation/reservation.snippets";
import {PaymentPlanSimpleSnippet} from "../paymentPlan/paymentPlan.snippts";
import {CompanyBlankSnippet} from "@coreModule/database/schemas/company/company.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

/**
 * Sale payment type
 */
export enum SalePaymentType {
    CASH = "cash",
    PAYMENT_PLAN = "payment_plan"
}

export enum SaleApprovalStatus {
    PENDING_APPROVAL = "pending_approval",
    APPROVED = "approved",
    REJECTED = "rejected",
}

/**
 * Sale model
 * Tracks unit sales as a separate collection
 */
export interface ISale extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;                           // Unique code (e.g. SALE-YYYYMMDD-XXXXXXXX), auto-generated on create
    unit: IUnit;                            // Unit being sold
    paymentType: SalePaymentType;           // Cash or payment plan
    buyer?: IUser;                          // Buyer (shared for cash and payment plan)
    buyerCompany?: ICompany;                // Optional buyer company (shared)
    soldBy: IUser;                          // User who processed the sale
    saleDate: Date;                         // Date of sale

    listedUnitPrice?: Decimal128;           // Unit price snapshot used for derived sale pricing
    listedUnitCurrency?: ICurrency;         // Unit currency snapshot used for derived sale pricing
    /** Units of sale currency per one unit of listed price currency (listed price × rate = basis in sale currency). */
    saleExchangeRate?: Decimal128;
    localDiscount?: Decimal128;             // Local discount percentage applied after reservation deduction
    finalPrice: Decimal128;                 // Final sale price
    saleCurrency: ICurrency;                // Currency of sale

    notes?: string;                         // General sale notes
    additionalDocuments?: IMedia[];         // Additional documents (shared)
    purchaseContract?: IMedia;              // Purchase contract (shared)

    transactionReference?: string;

    reservation?: IReservation;             // Active reservation preserved when a reserved unit is sold
    reservationDepositAmount?: Decimal128;  // Reservation deposit snapshot used for commission netting
    reservationDepositCurrency?: ICurrency; // Reservation deposit currency snapshot
    reservationExchangeRate?: Decimal128;   // Conversion rate from reservation currency to sale currency
    reservationConvertedAmount?: Decimal128; // Reservation deposit converted into sale currency

    paymentPlan?: IPaymentPlan;             // Payment plan reference (if paymentType is PAYMENT_PLAN)
    /** When the sale-created confirmation email was dispatched (UTC). Server-only. */
    saleConfirmationEmailSentAt?: Date;

    /** Only present when the company has requiresSaleApproval=true. */
    approvalStatus?: SaleApprovalStatus;
    /** Approval sub-document set when the manager approves or rejects the sale. */
    saleApproval?: IApprovalStage;

    // FEAT-004 — handover tracking
    handoverDate?: Date;
    handoverCertificate?: IMedia;
    handedOverBy?: IUser;
    handoverNotes?: string;

    // FEAT-014 — title transfer tracking
    titleTransferDate?: Date;
    deedNumber?: string;
    notaryName?: string;
    titleTransferCertificate?: IMedia;
}

const SaleSchema = new Schema<ISale>(
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
        unit: {
            type: SchemaTypes.ObjectId,
            ref: 'Unit',
            required: true,
            index: true,
            // unique: true, // One sale per unit,
            refAllowlist: UnitSnippet
        },
        paymentType: {
            type: SchemaTypes.String,
            enum: Object.values(SalePaymentType),
            required: true,
            index: true
        },
        buyer: {
            type: SchemaTypes.ObjectId,
            ref: 'User',
            required: false,
            refAllowlist: SimpleBlankUserSnippet
        },
        buyerCompany: {
            type: SchemaTypes.ObjectId,
            ref: 'Company',
            required: false,
            refAllowlist: CompanyBlankSnippet
        },
        soldBy: {
            type: SchemaTypes.ObjectId,
            ref: 'User',
            required: true,
            index: true,
            refAllowlist: SimpleBlankUserSnippet
        },
        saleDate: {
            type: SchemaTypes.Date,
            required: true,
            default: Date.now,
            index: true
        },
        saleCurrency: {
            type: SchemaTypes.ObjectId,
            ref: 'Currency',
            required: true,
            refAllowlist: CurrencySimpleSnippet
        },

        listedUnitPrice: {
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
                message: 'Listed unit price must be non-negative'
            }
        },
        listedUnitCurrency: {
            type: SchemaTypes.ObjectId,
            ref: 'Currency',
            required: false,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        saleExchangeRate: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128 | null | undefined) => {
                if (v == null || v === "") return undefined;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128 | undefined) {
                    if (!value) return true;
                    const numValue = parseFloat(value.toString());
                    return numValue > 0;
                },
                message: 'Sale exchange rate must be greater than 0'
            },
            dynamicTableConfiguration: {
                hideColumn: true,
            },
            permissions: {
                self: {
                    publicWrite: true
                },
                others: {
                    publicWrite: true
                }
            }
        },
        localDiscount: {
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
                message: 'Local discount must be non-negative'
            },
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.PERCENTAGE
            }
        },
        finalPrice: {
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
                message: 'Final price must be non-negative'
            }
        },

        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        purchaseContract: {
            type: SchemaTypes.ObjectId,
            ref: 'Media',
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        additionalDocuments: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: 'Media'
            }],
            required: false,
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        transactionReference: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
        },

        reservation: {
            type: SchemaTypes.ObjectId,
            ref: 'Reservation',
            required: false,
            index: true,
            refAllowlist: ReservationSnippet
        },
        // these values are frozen from the reservation
        reservationDepositAmount: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128 | null | undefined) => {
                if (v == null || v === "") return undefined;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128 | undefined) {
                    if (!value) return true;
                    const numValue = parseFloat(value.toString());
                    return numValue >= 0;
                },
                message: 'Reservation deposit amount must be non-negative'
            },
            dynamicTableConfiguration: {
                hideColumn: true,
            }
        },
        reservationDepositCurrency: {
            type: SchemaTypes.ObjectId,
            ref: 'Currency',
            required: false,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
            },
        },
        reservationExchangeRate: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128 | null | undefined) => {
                if (v == null || v === "") return undefined;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128 | undefined) {
                    if (!value) return true;
                    const numValue = parseFloat(value.toString());
                    return numValue > 0;
                },
                message: 'Reservation exchange rate must be greater than 0'
            },
            dynamicTableConfiguration: {
                hideColumn: true,
            },
            permissions: {
                self: {
                    publicWrite: true
                },
                others: {
                    publicWrite: true
                }
            }
        },
        reservationConvertedAmount: {
            type: SchemaTypes.Decimal128,
            required: false,
            set: (v: number | string | Decimal128 | null | undefined) => {
                if (v == null || v === "") return undefined;
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128 | undefined) {
                    if (!value) return true;
                    const numValue = parseFloat(value.toString());
                    return numValue >= 0;
                },
                message: 'Reservation converted amount must be non-negative'
            },
            dynamicTableConfiguration: {
                hideColumn: true,
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

        saleConfirmationEmailSentAt: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },

        paymentPlan: {
            type: SchemaTypes.ObjectId,
            ref: 'PaymentPlan',
            required: false,
            refAllowlist: PaymentPlanSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ["name"],
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
        approvalStatus: {
            type: SchemaTypes.String,
            enum: Object.values(SaleApprovalStatus),
            required: false,
            index: true,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        saleApproval: {
            type: getApprovalStageSchemaDefinition(),
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        // FEAT-004 — handover tracking
        handoverDate: {type: SchemaTypes.Date, required: false},
        handoverCertificate: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {hideColumn: true},
        },
        handedOverBy: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: false,
            refAllowlist: SimpleBlankUserSnippet,
        },
        handoverNotes: {type: SchemaTypes.String, required: false, trim: true},
        // FEAT-014 — title transfer tracking
        titleTransferDate: {type: SchemaTypes.Date, required: false},
        deedNumber: {type: SchemaTypes.String, required: false, trim: true},
        notaryName: {type: SchemaTypes.String, required: false, trim: true},
        titleTransferCertificate: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {hideColumn: true},
        },
    },
    {
        accessMode: "loose",
    }
);

// Pre-save middleware
SaleSchema.pre('save', function(next) {
    const sale = this as unknown as ISale;
    
    // Auto-generate unique name for new sales: SALE-YYYYMMDD-XXXXXXXX
    if (sale.isNew && !sale.name) {
        const date = sale.saleDate ? new Date(sale.saleDate) : new Date();
        const datePart = dayjs(date).format('YYYYMMDD');
        const randomPart = crypto.randomBytes(4).toString('hex');
        sale.name = `SALE-${datePart}-${randomPart}`.toUpperCase();
    }
    next();
});

ownershipPlugin(SaleSchema);
auditPlugin(SaleSchema);
softDeletePlugin(SaleSchema);
lifeCyclePlugin(SaleSchema);
applySaleIndexes(SaleSchema);
const Sale = model<ISale>('Sale', SaleSchema);
normalizeSchemaPermissions(Sale);
export default Sale;

addModelData(Sale, saleViews);
// saleDate is required in Mongoose but the `date` type has no schemaDefBuilder equivalent
validateSchemaDefAgainstMongoose(SaleSchema, SaleSchemaDef, "Sale", ["saleDate", "approvalStatus", "saleApproval", "handoverDate", "titleTransferDate"]);