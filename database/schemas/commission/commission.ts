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
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";

export enum CommissionSourceType {
    SALE = "sale",
    RESERVATION = "reservation"
}

export enum CommissionStatus {
    PENDING = "pending",
    PENDING_APPROVAL = "pending_approval",
    APPROVED = "approved",
    PAID = "paid",
    VOIDED = "voided"
}

export enum CommissionBasis {
    DEPOSIT_AMOUNT = "depositAmount",
    FINAL_PRICE = "finalPrice",
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
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name", "surname"],
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
        recordedByActionUser: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: false,
            refAllowlist: SimpleBlankUserSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name", "surname"],
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
        sourceType: {
            type: SchemaTypes.String,
            enum: Object.values(CommissionSourceType),
            required: true,
            index: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.ENUM,
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
        sourceId: {
            type: SchemaTypes.ObjectId,
            required: true,
            index: true,
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false,
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
        basis: {
            type: SchemaTypes.String,
            enum: Object.values(CommissionBasis),
            required: true,
            trim: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.ENUM,
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
        basisAmount: {
            type: SchemaTypes.Decimal128,
            required: true,
            set: (v: number | string | Decimal128) => {
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.NUMBER,
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
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.PERCENTAGE,
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
        amount: {
            type: SchemaTypes.Decimal128,
            required: true,
            set: (v: number | string | Decimal128) => {
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.NUMBER,
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
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
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
        reservation: {
            type: SchemaTypes.ObjectId,
            ref: "Reservation",
            required: false,
            index: true,
            refAllowlist: ReservationSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
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
        currency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: true,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["symbol", "name"],
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
        status: {
            type: SchemaTypes.String,
            enum: Object.values(CommissionStatus),
            required: true,
            default: CommissionStatus.PENDING,
            index: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.ENUM,
            },
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                sortable: false,
            },
        },
        paymentReference: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
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
            dynamicTableConfiguration: {
                sortable: false,
                cellType: COLUMN_TYPE.FILE,
            },
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        paidAt: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.DATE,
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
        voidedAt: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.DATE,
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
        splits: {
            type: [{
                agent: {
                    type: SchemaTypes.ObjectId,
                    ref: "User",
                    required: true,
                    refAllowlist: SimpleBlankUserSnippet,
                    dynamicTableConfiguration: {
                        filterable: true,
                        sortable: true,
                        cellType: COLUMN_TYPE.OBJECT_ID,
                        refDisplayKey: ["name", "surname"],
                    },
                },
                label: {
                    type: SchemaTypes.String,
                    required: false,
                    trim: true,
                    dynamicTableConfiguration: {
                        filterable: true,
                        sortable: true,
                        cellType: COLUMN_TYPE.STRING,
                    },
                },
                ratePercent: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: 0,
                    max: 100,
                    dynamicTableConfiguration: {
                        filterable: true,
                        sortable: true,
                        cellType: COLUMN_TYPE.PERCENTAGE,
                    },
                },
                amount: {
                    type: SchemaTypes.Decimal128,
                    required: true,
                    set: (v: number | string | Decimal128) => {
                        if (v instanceof Decimal128) return v;
                        return Decimal128.fromString(v.toString());
                    },
                    dynamicTableConfiguration: {
                        filterable: true,
                        sortable: true,
                        cellType: COLUMN_TYPE.NUMBER,
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
