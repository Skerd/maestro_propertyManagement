import * as crypto from 'crypto';
import dayjs from 'dayjs';
import {Decimal128} from 'mongodb';
import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {IUser} from "@coreModule/database/schemas/user/user";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IInspection} from "../inspection/inspection";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {
    applyModificationRequestIndexes
} from "./modificationRequest.indexes";
import {addModelData} from "@coreModule/database/collections";
import {
    modificationRequestViews
} from "./modificationRequest.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {ModificationRequestSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.schema-def";
import {UnitSimpleSnippet, UnitSnippet} from "../unit/unit.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {InspectionSimpleSnippet} from "../inspection/inspection.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

/**
 * Modification request status enum
 * Tracks the overall workflow state of the request
 */
export enum ModificationRequestStatus {
    PENDING_ARCHITECT = "pending_architect",
    PENDING_ENGINEER = "pending_engineer",
    PENDING_CEO = "pending_ceo",
    PENDING_ARCHITECT_REVISION = "pending_architect_revision",
    PENDING_ENGINEER_REVISION = "pending_engineer_revision",
    PENDING_FINANCE = "pending_finance",
    PENDING_CLIENT_APPROVAL = "pending_client_approval",
    FINANCE_COMPLETED = "finance_completed",
    PENDING_DELIVERY = "pending_delivery",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}

/**
 * Construction type enum
 * Categorizes the type of modification requested
 */
export enum ConstructionType {
    MATERIALS = "materials",
    ROOM_DIVISION = "room_division",
    FLOORING = "flooring",
    UTILITIES = "utilities",
    STRUCTURAL = "structural",
    ELECTRICAL = "electrical",
    PLUMBING = "plumbing",
    HVAC = "hvac",
    COSMETIC = "cosmetic",
    OTHER = "other"
}

/**
 * Approval decision enum
 */
export enum ApprovalDecision {
    APPROVED = "approved",
    REJECTED = "rejected",
    PENDING = "pending"
}

export const ModificationRequestTransitions: Record<ModificationRequestStatus, ModificationRequestStatus[]> = {
    [ModificationRequestStatus.PENDING_ARCHITECT]: [
        ModificationRequestStatus.PENDING_ENGINEER,
        ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_ENGINEER]: [
        ModificationRequestStatus.PENDING_CEO,
        ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_CEO]: [
        ModificationRequestStatus.PENDING_FINANCE,
        ModificationRequestStatus.PENDING_ENGINEER_REVISION,
        ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_ARCHITECT_REVISION]: [
        ModificationRequestStatus.PENDING_ARCHITECT,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_ENGINEER_REVISION]: [
        ModificationRequestStatus.PENDING_ENGINEER,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_FINANCE]: [
        ModificationRequestStatus.PENDING_CLIENT_APPROVAL,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_CLIENT_APPROVAL]: [
        ModificationRequestStatus.FINANCE_COMPLETED,
        ModificationRequestStatus.PENDING_FINANCE,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.FINANCE_COMPLETED]: [
        ModificationRequestStatus.PENDING_DELIVERY,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.PENDING_DELIVERY]: [
        ModificationRequestStatus.COMPLETED,
        ModificationRequestStatus.PENDING_ENGINEER_REVISION,
        ModificationRequestStatus.PENDING_ARCHITECT_REVISION,
        ModificationRequestStatus.CANCELLED
    ],
    [ModificationRequestStatus.COMPLETED]: [],
    [ModificationRequestStatus.CANCELLED]: []
};

export function canTransitionModificationRequestStatus(from: ModificationRequestStatus, to: ModificationRequestStatus): boolean {
    return ModificationRequestTransitions[from]?.includes(to) ?? false;
}

/**
 * Approval stage interface
 * Tracks approval/rejection for each workflow stage
 */
export interface IApprovalStage {
    decision: ApprovalDecision;
    user?: IUser;
    notes?: string;
    reviewedAt?: Date;
    media?: IMedia[];
    materialsPlan?: {
        item: string;
        quantity?: number;
        unit?: string;
        notes?: string;
        pricePerUnit?: Decimal128;
        currency?: ICurrency;
    }[];
    inspections?: IInspection[];
}

/**
 * Finance stage details interface
 * Extended information for the finance approval stage
 */
export interface IFinanceStageDetails {
    totalCost: Number;
    currency: ICurrency;
    costBreakdown?: {
        item: string;
        cost: Number;
        quantity?: number;
        unit?: string;
        source?: "engineer_material" | "manual";
    }[];
    media: IMedia[];
    notes?: string;
    estimatedCompletionDate?: Date;
}

/**
 * Unit modification request interface
 * Tracks client requests for unit modifications through approval workflow
 */
export interface IModificationRequest extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    // Core fields
    name?: string;                  // Unique code (e.g. MOD-YYYYMMDD-XXXXXXXX), auto-generated on create
    
    // Core references
    unit: IUnit;                    // Unit being modified
    requestedBy: IUser;             // Client/user who made the request
    
    // Request details
    title: string;                   // Brief title/summary of the request
    description: string;              // Detailed description of the modification
    constructionType: ConstructionType; // Type of construction/modification
    specifications?: string;        // Technical specifications or requirements
    
    // Workflow status
    status: ModificationRequestStatus; // Current workflow status
    
    // Approval stages
    architectApproval: IApprovalStage;  // Architect review stage
    engineerApproval: IApprovalStage;    // Engineer review stage
    ceoApproval: IApprovalStage;        // CEO review stage
    financeDetails?: IFinanceStageDetails; // Finance stage details (costs, media, etc.)
    clientCostApproval?: IApprovalStage; // Client acceptance of the finance cost estimate
    deliveryApproval: IApprovalStage;    // Delivery stage (completion confirmation)
    inspections?: IInspection[];         // Linked inspections when modification is completed
    
    // SLA tracking
    stageDueDate?: Date;            // Deadline for current stage (set on each status change)

    // Notification tracking
    clientNotifiedAt?: Date;        // When client was notified of completion
    notificationSent: boolean;      // Flag to track if notification was sent

    // Lifecycle timestamps
    submittedAt: Date;              // When request was initially submitted
    completedAt?: Date;             // When request workflow was completed
    cancelledAt?: Date;              // When request was cancelled
    cancellationReason?: string;    // Reason for cancellation
}

export function getApprovalStageSchemaDefinition(config?: {withMaterialsPlan?: boolean; withInspections?: boolean}) {
    const base: any = {
        decision: {
            type: SchemaTypes.String,
            enum: Object.values(ApprovalDecision),
            required: true,
            default: ApprovalDecision.PENDING
        },
        user: {
            type: SchemaTypes.ObjectId,
            ref: 'User',
            required: false,
            refAllowlist: SimpleBlankUserSnippet
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true
        },
        reviewedAt: {
            type: SchemaTypes.Date,
            required: false
        },
        media: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            required: false,
            refAllowlist: MediaSimpleSnippet,
            default: []
        }
    };
    if (config?.withMaterialsPlan) {
        base.materialsPlan = {
            type: [{
                type: {
                    item:         {type: SchemaTypes.String,   required: true,  trim: true},
                    quantity:     {type: SchemaTypes.Number,   required: false, min: 0},
                    unit:         {type: SchemaTypes.String,   required: false, trim: true},
                    notes:        {type: SchemaTypes.String,   required: false, trim: true},
                    pricePerUnit: {
                        type:     SchemaTypes.Decimal128,
                        required: false,
                        set: (v: unknown) => {
                            if (v == null) return v;
                            if (v instanceof Decimal128) return v;
                            return Decimal128.fromString(String(v));
                        },
                    },
                    currency:     {type: SchemaTypes.ObjectId, required: false, ref: "Currency", refAllowlist: CurrencySimpleSnippet},
                }
            }],
            required: false,
            default: []
        };
    }
    if (config?.withInspections) {
        base.inspections = {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: 'Inspection'
            }],
            required: false,
            default: [],
            refAllowlist: InspectionSimpleSnippet
        };
    }
    return base;
}

const ModificationRequestSchema = new Schema<IModificationRequest>(
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
            refAllowlist: UnitSnippet
        },
        requestedBy: {
            type: SchemaTypes.ObjectId,
            ref: 'User',
            required: true,
            index: true,
            refAllowlist: SimpleBlankUserSnippet
        },
        title: {
            type: SchemaTypes.String,
            required: true
        },
        description: {
            type: SchemaTypes.String,
            required: true
        },
        constructionType: {
            type: SchemaTypes.String,
            enum: Object.values(ConstructionType),
            required: true,
            default: ConstructionType.OTHER,
            index: true
        },
        specifications: {
            type: SchemaTypes.String,
            required: false,
            trim: true
        },
        status: {
            type: SchemaTypes.String,
            enum: Object.values(ModificationRequestStatus),
            required: true,
            default: ModificationRequestStatus.PENDING_ARCHITECT,
            index: true
        },


        architectApproval: {
            type: getApprovalStageSchemaDefinition(),
            required: true
        },
        engineerApproval: {
            type: getApprovalStageSchemaDefinition({withMaterialsPlan: true}),
            required: true
        },
        ceoApproval: {
            type: getApprovalStageSchemaDefinition(),
            required: true
        },
        financeDetails: {
            type: {
                totalCost: {
                    type: SchemaTypes.Number,
                    required: false,
                    min: 0
                },
                currency: {
                    type: SchemaTypes.ObjectId,
                    ref: 'Currency',
                    required: false,
                    refAllowlist: CurrencySimpleSnippet
                },
                costBreakdown: [{
                    type: {
                        item: {
                            type: SchemaTypes.String,
                            required: true,
                            trim: true
                        },
                        cost: {
                            type: SchemaTypes.Number,
                            required: true
                        },
                        quantity: {
                            type: SchemaTypes.Number,
                            required: false,
                            min: [0]
                        },
                        unit: {
                            type: SchemaTypes.String,
                            required: false,
                            trim: true
                        },
                        source: {
                            type: SchemaTypes.String,
                            enum: ["engineer_material", "manual"],
                            required: false,
                            default: "manual"
                        }
                    },
                    required: false,
                    default: []
                }],
                media: {
                    type: [{
                        type: SchemaTypes.ObjectId,
                        ref: "Media"
                    }],
                    required: false,
                    refAllowlist: MediaSimpleSnippet,
                    default: []
                },
                notes: {
                    type: SchemaTypes.String,
                    required: false
                },
                estimatedCompletionDate: {
                    type: SchemaTypes.Date,
                    required: false
                },
            },
            required: false
        },

        stageDueDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
            permissions: {
                self: { write: "no-permission" },
                others: { write: "no-permission" },
            },
        },
        clientNotifiedAt: {
            type: SchemaTypes.Date,
            required: false
        },
        notificationSent: {
            type: SchemaTypes.Boolean,
            required: true,
            default: false,
            index: true
        },
        submittedAt: {
            type: SchemaTypes.Date,
            required: true,
            default: Date.now,
            index: true
        },
        clientCostApproval: {
            type: getApprovalStageSchemaDefinition(),
            required: false,
            permissions: {
                self: { write: "no-permission" },
                others: { write: "no-permission" },
            },
        },
        deliveryApproval: {
            type: getApprovalStageSchemaDefinition({withInspections: true}),
            required: true
        },

        inspections: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: 'Inspection'
            }],
            required: false,
            default: [],
            refAllowlist: InspectionSimpleSnippet
        },

        completedAt: {
            type: SchemaTypes.Date,
            required: false
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
            required: false
        }
    },
    {
        accessMode: "loose"
    }
);

// SLA days per pending stage. Terminal / non-actionable stages get no deadline.
const STAGE_SLA_DAYS: Partial<Record<ModificationRequestStatus, number>> = {
    [ModificationRequestStatus.PENDING_ARCHITECT]:         3,
    [ModificationRequestStatus.PENDING_ENGINEER]:          5,
    [ModificationRequestStatus.PENDING_CEO]:               3,
    [ModificationRequestStatus.PENDING_ARCHITECT_REVISION]:3,
    [ModificationRequestStatus.PENDING_ENGINEER_REVISION]: 3,
    [ModificationRequestStatus.PENDING_FINANCE]:           7,
    [ModificationRequestStatus.PENDING_CLIENT_APPROVAL]:   5,
    [ModificationRequestStatus.PENDING_DELIVERY]:         14,
};

// Pre-save middleware to handle status transitions and timestamps
ModificationRequestSchema.pre('save', function(next) {
    const request = this as IModificationRequest;
    // Set submittedAt on creation
    if (request.isNew && !request.submittedAt) {
        request.submittedAt = new Date();
    }
    // Auto-generate unique name for new requests: MOD-YYYYMMDD-XXXXXXXX
    if (request.isNew && !request.name) {
        const date = request.submittedAt ? new Date(request.submittedAt) : new Date();
        const datePart = dayjs(date).format('YYYYMMDD');
        const randomPart = crypto.randomBytes(4).toString('hex');
        request.name = `MOD-${datePart}-${randomPart}`.toUpperCase();
    }
    
    // Initialize deliveryApproval with default values if not set
    if (request.isNew && !request.deliveryApproval) {
        request.deliveryApproval = {
            decision: ApprovalDecision.PENDING
        } as any;
    }

    // Handle status transitions and set appropriate timestamps
    if (request.isModified('status')) {
        // Set completedAt when workflow is completed
        if (request.status === ModificationRequestStatus.COMPLETED && !request.completedAt) {
            request.completedAt = new Date();
        }

        // Set cancelledAt when request is cancelled
        if (request.status === ModificationRequestStatus.CANCELLED && !request.cancelledAt) {
            request.cancelledAt = new Date();
        }

        // Update SLA deadline for the new stage
        const slaDays = STAGE_SLA_DAYS[request.status];
        if (slaDays !== undefined) {
            const due = new Date();
            due.setUTCDate(due.getUTCDate() + slaDays);
            due.setUTCHours(23, 59, 59, 999);
            request.stageDueDate = due;
        } else {
            request.stageDueDate = undefined;
        }
    }

    next();
});

ownershipPlugin(ModificationRequestSchema);
auditPlugin(ModificationRequestSchema);
softDeletePlugin(ModificationRequestSchema);
lifeCyclePlugin(ModificationRequestSchema);
applyModificationRequestIndexes(ModificationRequestSchema);
const ModificationRequest = model<IModificationRequest>('ModificationRequest', ModificationRequestSchema);
normalizeSchemaPermissions(ModificationRequest);
export default ModificationRequest;

addModelData(ModificationRequest, modificationRequestViews);
// Approval stage objects (architectApproval/engineerApproval/ceoApproval/deliveryApproval) are complex
// embedded objects with no schemaDefBuilder equivalent; notificationSent and submittedAt are system-managed
validateSchemaDefAgainstMongoose(ModificationRequestSchema, ModificationRequestSchemaDef, "ModificationRequest", [
    "architectApproval",
    "engineerApproval",
    "ceoApproval",
    "clientCostApproval",
    "deliveryApproval",
    "notificationSent",
    "submittedAt",
    "stageDueDate",
]);
