import {Document, model, Schema, SchemaTypes, Types} from 'mongoose';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import {IUser} from "@coreModule/database/schemas/user/user";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {applyInspectionIndexes} from "./inspection.indexes";
import {addModelData} from "@coreModule/database/collections";
import {inspectionViews} from "./inspection.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {InspectionSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.schema-def";
import {UnitSnippet} from "../unit/unit.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {InspectionSimpleSnippet} from "./inspection.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export enum InspectionStatus {
    SCHEDULED = "scheduled",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    RESCHEDULED = "rescheduled"
}
export enum InspectionType {
    INITIAL = "initial",
    FOLLOW_UP = "follow_up",
    FINAL = "final",
    ROUTINE = "routine",
    COMPLAINT = "complaint",
    PRE_SALE = "pre_sale",
    POST_SALE = "post_sale"
}
export enum FindingSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical",
}

export interface IInspectionFindingItem {
    notes: string;
    media: IMedia[];
    severity?: FindingSeverity;
    resolvedAt?: Date;
    resolvedBy?: IUser;
}

export interface IInspectionFindings {
    structuralIssues?: IInspectionFindingItem[];
    electricalIssues?: IInspectionFindingItem[];
    plumbingIssues?: IInspectionFindingItem[];
    hvacIssues?: IInspectionFindingItem[];
    safetyConcerns?: IInspectionFindingItem[];
    cosmeticIssues?: IInspectionFindingItem[];
    otherObservations?: IInspectionFindingItem[];
}

export interface IInspection extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    unit: IUnit;
    inspectedBy: IUser;
    inspectionDate: Date;
    scheduledDate?: Date;
    type: InspectionType;
    status: InspectionStatus;
    notes?: string;
    findings?: IInspectionFindings;
    rating?: number;
    media: IMedia[];
    nextInspectionDate?: Date;
    followUpRequired: boolean;
    followUpInspection?: Types.ObjectId | IInspection;
    followedUpByInspection?: Types.ObjectId | IInspection;
    completedAt?: Date;
    cancelledAt?: Date;
    cancellationReason?: string;
    clientSignatureMediaId?: IMedia;
    clientSignedAt?: Date;
}

function findingItemSchemaDef() {
    return {
        notes:     {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            dynamicTableConfiguration: {
                hideColumn: true,
                visible: false,
                filterable: false,
                sortable: false
            }
        },
        media:     {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
                visible: false,
                filterable: false,
                sortable: false
            }
        },
        severity:  {
            type: SchemaTypes.String,
            required: false,
            enum: Object.values(FindingSeverity),
            dynamicTableConfiguration: {
                hideColumn: true,
                visible: false,
                filterable: false,
                sortable: false
            }
        },
        resolvedAt:{
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                hideColumn: true,
                visible: false,
                filterable: false,
                sortable: false
            }
        },
        resolvedBy:{
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: false,
            refAllowlist: SimpleBlankUserSnippet,
            dynamicTableConfiguration: {
                hideColumn: true,
                visible: false,
                filterable: false,
                sortable: false
            }
        },
    };
}

const InspectionSchema = new Schema<IInspection>(
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
        unit: {
            type: SchemaTypes.ObjectId,
            ref: "Unit",
            required: true,
            index: true,
            refAllowlist: UnitSnippet,
        },
        inspectedBy: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            required: true,
            index: true,
            refAllowlist: SimpleBlankUserSnippet,
        },
        inspectionDate: {
            type: SchemaTypes.Date,
            required: true,
            index: true
        },
        scheduledDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
        type: {
            type: SchemaTypes.String,
            enum: Object.values(InspectionType),
            required: true,
            default: InspectionType.ROUTINE,
        },
        status: {
            type: SchemaTypes.String,
            enum: Object.values(InspectionStatus),
            required: true,
            default: InspectionStatus.SCHEDULED,
            index: true,
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
        },
        findings: {
            type: {
                structuralIssues:  {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
                electricalIssues:  {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
                plumbingIssues:    {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
                hvacIssues:        {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
                safetyConcerns:    {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
                cosmeticIssues:    {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
                otherObservations: {type: [findingItemSchemaDef()], default: [], dynamicTableConfiguration: {hideColumn: true}},
            },
            required: false,
        },
        rating: {
            type: SchemaTypes.Number,
            required: false,
            min: 1,
            max: 10,
        },
        media: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            required: false,
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {hideColumn: true},
        },
        nextInspectionDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
        followUpRequired: {
            type: SchemaTypes.Boolean,
            required: true,
            default: false,
            index: true,
        },
        followUpInspection: {
            type: SchemaTypes.ObjectId,
            ref: "Inspection",
            required: false,
            index: true,
            refAllowlist: InspectionSimpleSnippet,
        },
        followedUpByInspection: {
            type: SchemaTypes.ObjectId,
            ref: "Inspection",
            required: false,
            index: true,
            refAllowlist: InspectionSimpleSnippet,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        completedAt: {
            type: SchemaTypes.Date,
            required: false,
        },
        cancelledAt: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {
                self: {write: "no-permission"},
                others: {write: "no-permission"},
            },
        },
        cancellationReason: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            dynamicTableConfiguration: {visible: true},
        },
        clientSignatureMediaId: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {hideColumn: true},
        },
        clientSignedAt: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
    },
    {accessMode: "loose"},
);

// Auto-generates name INSP-YYYYMMDD-XXXXXXXX on first save; sets completedAt/cancelledAt on status transition.
InspectionSchema.pre("save", function (next) {
    const inspection = this as IInspection;

    if (!inspection.inspectionDate && inspection.scheduledDate) {
        inspection.inspectionDate = inspection.scheduledDate;
    }

    if (inspection.isNew && !inspection.name) {
        const datePart = dayjs(inspection.inspectionDate).format("YYYYMMDD");
        const randomPart = crypto.randomBytes(4).toString("hex");
        inspection.name = `INSP-${datePart}-${randomPart}`.toUpperCase();
    }

    if (inspection.isModified("status")) {
        if (inspection.status === InspectionStatus.COMPLETED && !inspection.completedAt) {
            inspection.completedAt = new Date();
        }
        if (inspection.status === InspectionStatus.CANCELLED && !inspection.cancelledAt) {
            inspection.cancelledAt = new Date();
        }
    }

    next();
});

ownershipPlugin(InspectionSchema);
auditPlugin(InspectionSchema);
softDeletePlugin(InspectionSchema);
lifeCyclePlugin(InspectionSchema);
applyInspectionIndexes(InspectionSchema);
const Inspection = model<IInspection>("Inspection", InspectionSchema);
normalizeSchemaPermissions(Inspection);
export default Inspection;

addModelData(Inspection, inspectionViews);
validateSchemaDefAgainstMongoose(InspectionSchema, InspectionSchemaDef, "Inspection");
