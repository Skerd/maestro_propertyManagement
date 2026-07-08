import {Document, model, Schema, SchemaTypes, Types} from "mongoose";
import {Decimal128} from "mongodb";
import {IUser} from "@coreModule/database/schemas/user/user";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {applyCommissionIndexes} from "./commission.indexes";
import type {ISale} from "../sale/sale";
import type {IReservation} from "../reservation/reservation";
import {addModelData} from "@coreModule/database/collections";
import {commissionViews} from "./commission.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {CommissionSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/commission.schema-def";
import {ReservationSimpleSnippet,} from "../reservation/reservation.snippets";
import {SaleSimpleSnippet} from "../sale/sale.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {IMedia} from "@coreModule/database/schemas/media/media";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export enum CommissionSourceType {
    SALE = "sale",
    RESERVATION = "reservation"
}

export enum CommissionStatus {
    PENDING = "pending",
    PENDING_APPROVAL = "pending_approval",
    PAID = "paid",
    VOIDED = "voided"
}

export interface ICommissionSplit {
    agent: IUser;
    label?: string;
    ratePercent: number;
    amount: Decimal128;
}

export interface ICommission extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    agent: IUser;
    /** User who performed the API action (e.g. impersonation actor); not necessarily the beneficiary. */
    recordedByActionUser?: IUser;
    sourceType: CommissionSourceType;
    sourceId: Types.ObjectId;
    basis: string;
    basisAmount: Decimal128;
    ratePercent: number;
    amount: Decimal128;
    sale?: ISale;
    reservation?: IReservation;
    currency: ICurrency;
    status: CommissionStatus;
    notes?: string;
    paidAt?: Date;
    voidedAt?: Date;
    paymentReceiptMediaId?: IMedia;
    paymentReference?: string;
    splits?: ICommissionSplit[];
}

const CommissionSchema = new Schema<ICommission>(
    {
        agent: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            index: true,
            refAllowlist: SimpleBlankUserSnippet,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        recordedByActionUser: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: false,
            refAllowlist: SimpleBlankUserSnippet,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        sourceType: {
            type: SchemaTypes.String,
            enum: Object.values(CommissionSourceType),
            required: true,
            index: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        sourceId: {
            type: SchemaTypes.ObjectId,
            required: true,
            index: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        basis: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        basisAmount: {
            type: SchemaTypes.Decimal128,
            required: true,
            set: (v: number | string | Decimal128) => {
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
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
        ratePercent: {
            type: SchemaTypes.Number,
            required: true,
            default: 0,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        amount: {
            type: SchemaTypes.Decimal128,
            required: true,
            set: (v: number | string | Decimal128) => {
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
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
        sale: {
            type: SchemaTypes.ObjectId,
            ref: "Sale",
            required: false,
            index: true,
            refAllowlist: SaleSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ["name"]
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
        reservation: {
            type: SchemaTypes.ObjectId,
            ref: "Reservation",
            required: false,
            index: true,
            refAllowlist: ReservationSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ["name"]
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
        currency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: true,
            refAllowlist: CurrencySimpleSnippet,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                }
            }
        },
        status: {
            type: SchemaTypes.String,
            enum: Object.values(CommissionStatus),
            required: true,
            default: CommissionStatus.PENDING,
            index: true
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true
        },
        paymentReference: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        paymentReceiptMediaId: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        paidAt: {
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
        voidedAt: {
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
        splits: {
            type: [{
                agent: {
                    type: SchemaTypes.ObjectId,
                    ref: "User",
                    required: true,
                    refAllowlist: SimpleBlankUserSnippet,
                },
                label: {type: SchemaTypes.String, required: false, trim: true},
                ratePercent: {type: SchemaTypes.Number, required: true, min: 0, max: 100},
                amount: {
                    type: SchemaTypes.Decimal128,
                    required: true,
                    set: (v: number | string | Decimal128) => {
                        if (v instanceof Decimal128) return v;
                        return Decimal128.fromString(v.toString());
                    },
                },
            }],
            required: false,
            default: undefined,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
    },
    {
        accessMode: "loose",
        permissions: {
            self: {
                create: "no-permission",
                delete: "no-permission",
                restore: "no-permission",
            },
            others: {
                create: "no-permission",
                delete: "no-permission",
                restore: "no-permission",
            },
        },
    }
);

ownershipPlugin(CommissionSchema);
auditPlugin(CommissionSchema);
softDeletePlugin(CommissionSchema);
lifeCyclePlugin(CommissionSchema);
applyCommissionIndexes(CommissionSchema);
const Commission = model<ICommission>("Commission", CommissionSchema);
normalizeSchemaPermissions(Commission);
export default Commission;

addModelData(Commission, commissionViews);
validateSchemaDefAgainstMongoose(CommissionSchema, CommissionSchemaDef, "Commission", ["paymentReceiptMediaId", "splits"]);
