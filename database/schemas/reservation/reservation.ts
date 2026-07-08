import * as crypto from 'crypto';
import dayjs from 'dayjs';
import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {Decimal128} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {applyReservationIndexes} from "./reservation.indexes";
import {addModelData} from "@coreModule/database/collections";
import {reservationViews} from "./reservation.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {ReservationSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.schema-def";
import {RESERVATION_SOURCE_VALUES, ReservationSource} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.constants";
import {UnitSaleSnippet} from "../unit/unit.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {CompanyBlankSnippet} from "@coreModule/database/schemas/company/company.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export enum ReservationStatus {
    ACTIVE = "active",
    EXPIRED = "expired",
    CANCELLED = "cancelled",
    CONVERTED = "converted",
}

/**
 * Reservation model
 * Tracks unit reservations as a separate collection
 */
export interface IReservation extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name?: string;                  // Unique code (e.g. RES-YYYYMMDD-XXXXXXXX), auto-generated on create
    unit: IUnit;                    // Unit being reserved
    reservedBy: IUser;              // User who made the reservation
    reservedByCompany: ICompany;   // Company that made the reservation
    client: IUser;                  // Client (buyer) user
    reservationDate: Date;          // When reservation was made
    expirationDate?: Date;          // Optional expiration date for reservation
    reservationNotes?: string;      // Notes about the reservation
    depositAmount?: Decimal128;     // Optional deposit amount
    depositCurrency?: ICurrency;    // Currency for deposit
    /** Optional display hint (e.g. bank transfer); not required for reservation workflow. */
    paymentMethod?: string;
    source?: ReservationSource;
    referralCode?: string;
    isActive: boolean;              // Whether reservation is still active
    paid: boolean;
    /** When the reservation-created confirmation email was dispatched (UTC). Server-only. */
    confirmationEmailSentAt?: Date;
    /** When the 3-day / 1-day / day-of expiration reminder email was sent (UTC). Server-only. */
    expirationReminderEmailAt3d?: Date;
    expirationReminderEmailAt1d?: Date;
    expirationReminderEmailAt0d?: Date;
    /** First time the job observed the reservation past its expiration calendar day (UTC end-of-day). Server-only. */
    expiredAt?: Date;
    /** Computed status: active | expired | cancelled | converted. Server-managed, not user-writable. */
    status?: ReservationStatus;
    cancelledAt?: Date;             // When reservation was cancelled
    cancellationReason?: string;    // Reason for cancellation
    reservationContract?: IMedia[];  // Optional reservation contract documents
    additionalDocuments?: IMedia[]; // Optional supporting documents
}

const ReservationSchema = new Schema<IReservation>(
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
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
            refAllowlist: UnitSaleSnippet
        },
        reservedBy: {
            type: SchemaTypes.ObjectId,
            ref: 'User',
            required: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
            refAllowlist: SimpleBlankUserSnippet
        },
        reservedByCompany: {
            type: SchemaTypes.ObjectId,
            ref: 'Company',
            required: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
            refAllowlist: CompanyBlankSnippet
        },
        client: {
            type: SchemaTypes.ObjectId,
            ref: 'User',
            required: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            },
            refAllowlist: SimpleBlankUserSnippet
        },
        reservationDate: {
            type: SchemaTypes.Date,
            required: true,
            default: Date.now,
        },
        expirationDate: {
            type: SchemaTypes.Date,
            required: false,
        },
        reservationNotes: {
            type: SchemaTypes.String,
            required: false,
            trim: true
        },
        depositAmount: {
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
                message: 'Deposit amount must be non-negative'
            }
        },
        depositCurrency: {
            type: SchemaTypes.ObjectId,
            ref: 'Currency',
            required: false,
            refAllowlist: CurrencySimpleSnippet
        },
        paymentMethod: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                hideColumn: true,
            },
        },
        source: {
            type: SchemaTypes.String,
            enum: [...RESERVATION_SOURCE_VALUES],
            required: false,
            index: true,
            dynamicTableConfiguration: {
                hideColumn: true,
            },
        },
        referralCode: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                hideColumn: true,
            },
        },
        paid: {
            type: SchemaTypes.Boolean,
            required: true,
            default: false,
        },
        confirmationEmailSentAt: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        expirationReminderEmailAt3d: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        expirationReminderEmailAt1d: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        expirationReminderEmailAt0d: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        expiredAt: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        status: {
            type: SchemaTypes.String,
            enum: Object.values(ReservationStatus),
            required: false,
            index: true,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        isActive: {
            type: SchemaTypes.Boolean,
            required: true,
            default: true,
        },
        cancelledAt: {
            type: SchemaTypes.Date,
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
        cancellationReason: {
            type: SchemaTypes.String,
            required: false,
            trim: true
        },
        reservationContract: {
            type: [{type: SchemaTypes.ObjectId, ref: 'Media'}],
            required: false,
            default: [],
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
    },
    {
        accessMode: "loose",
    }
);

// Pre-save middleware
ReservationSchema.pre('save', function(next) {
    const reservation = this as unknown as IReservation;

    if (reservation.isNew && !reservation.status) {
        reservation.status = ReservationStatus.ACTIVE;
    }

    // Auto-generate unique name for new reservations: RES-YYYYMMDD-XXXXXXXX
    if (reservation.isNew && !reservation.name) {
        const date = reservation.reservationDate ? new Date(reservation.reservationDate) : new Date();
        const datePart = dayjs(date).format('YYYYMMDD');
        const randomPart = crypto.randomBytes(4).toString('hex');
        reservation.name = `RES-${datePart}-${randomPart}`.toUpperCase();
    }

    if (reservation.isModified('isActive') && !reservation.isActive && !reservation.cancelledAt) {
        reservation.cancelledAt = new Date();
    }

    if (!reservation.reservationDate) {
        reservation.reservationDate = new Date();
    }

    next();
});

ownershipPlugin(ReservationSchema);
auditPlugin(ReservationSchema);
softDeletePlugin(ReservationSchema);
lifeCyclePlugin(ReservationSchema);
applyReservationIndexes(ReservationSchema);
const Reservation = model<IReservation>('Reservation', ReservationSchema);
normalizeSchemaPermissions(Reservation);
export default Reservation;

addModelData(Reservation, reservationViews);
// reservationDate: required in Mongoose with default — no `date` type counterpart in SchemaDef
// status: server-managed enum with write: "no-permission" — not user-editable via form
validateSchemaDefAgainstMongoose(ReservationSchema, ReservationSchemaDef, "Reservation", ["reservationDate", "status"]);
