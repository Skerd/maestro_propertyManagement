import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IUnit} from "../unit/unit";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {IUser} from "@coreModule/database/schemas/user/user";
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
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    SnagSchemaDef,
    snagStatusValues,
    snagSeverityValues,
    SNAG_LONG_TEXT_MAX,
    SNAG_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.schema-def";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {WorkPackageSimpleSnippet} from "../workPackage/workPackage.snippets";
import {VariationOrderSimpleSnippet} from "../variationOrder/variationOrder.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {snagViews} from "./snag.views";
import {applySnagIndexes} from "./snag.indexes";

export interface ISnag extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    unit: IUnit;
    title: string;
    description?: string;
    location?: string;
    status?: string;
    severity?: string;
    reportedBy?: IUser;
    assignedTo?: IUser;
    dueDate?: Date;
    resolvedAt?: Date;
    photos: IMedia[];
    notes?: string;
    trade?: string;
    workPackage?: any;
    rootCause?: string;
    costImpact?: number;
    isWarranty?: boolean;
    isDlp?: boolean;
    variationOrder?: any;
}

const SnagSchema = new Schema<ISnag>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            maxlength: SNAG_SHORT_TEXT_MAX,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        unit: {
            type: SchemaTypes.ObjectId,
            ref: "Unit",
            required: true,
            refAllowlist: UnitSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        title: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: SNAG_SHORT_TEXT_MAX,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        description: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: SNAG_LONG_TEXT_MAX,
            dynamicTableConfiguration: {
                sortable: false,
            },
        },
        location: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: SNAG_SHORT_TEXT_MAX,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        status: {
            type: SchemaTypes.String,
            enum: [...snagStatusValues],
            required: false,
            default: "open",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.ENUM,
            },
        },
        severity: {
            type: SchemaTypes.String,
            enum: [...snagSeverityValues],
            required: false,
            default: "medium",
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.ENUM,
            },
        },
        reportedBy: {
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
        },
        assignedTo: {
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
        },
        dueDate: {
            type: SchemaTypes.Date,
            required: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.DATE,
            },
        },
        resolvedAt: {
            type: SchemaTypes.Date,
            required: false,
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.DATE,
            },
        },
        photos: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
            },
        },
        notes: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: SNAG_LONG_TEXT_MAX,
            dynamicTableConfiguration: {
                filterable: false,
            },
        },
        trade: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: SNAG_SHORT_TEXT_MAX,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.STRING,
            },
        },
        workPackage: {
            type: SchemaTypes.ObjectId,
            ref: "WorkPackage",
            required: false,
            refAllowlist: WorkPackageSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
        rootCause: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: SNAG_LONG_TEXT_MAX,
            dynamicTableConfiguration: {
                filterable: false,
            },
        },
        costImpact: {
            type: SchemaTypes.Number,
            required: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.NUMBER,
            },
        },
        isWarranty: {
            type: SchemaTypes.Boolean,
            required: false,
            default: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.BOOLEAN,
            },
        },
        isDlp: {
            type: SchemaTypes.Boolean,
            required: false,
            default: false,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.BOOLEAN,
            },
        },
        variationOrder: {
            type: SchemaTypes.ObjectId,
            ref: "VariationOrder",
            required: false,
            refAllowlist: VariationOrderSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: true,
                sortable: true,
                cellType: COLUMN_TYPE.OBJECT_ID,
                refDisplayKey: ["name"],
            },
        },
    },
    {accessMode: "loose"}
);

SnagSchema.pre("validate", function (next) {
    if (!this.name) {
        const date   = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name    = `SNAG-${date}-${suffix}`;
    }
    next();
});

SnagSchema.pre("save", function (next) {
    // auto-set resolvedAt when status transitions to resolved
    if (this.isModified("status") && (this as any).status === "resolved" && !(this as any).resolvedAt) {
        (this as any).resolvedAt = new Date();
    }
    next();
});

ownershipPlugin(SnagSchema);
auditPlugin(SnagSchema);
softDeletePlugin(SnagSchema);
lifeCyclePlugin(SnagSchema);
applySnagIndexes(SnagSchema);

const Snag = model<ISnag>("Snag", SnagSchema, "snags");
export default Snag;

normalizeSchemaPermissions(Snag);

addModelData(Snag, snagViews);
validateSchemaDefAgainstMongoose(SnagSchema, SnagSchemaDef, "Snag", ["name", "status"]);
