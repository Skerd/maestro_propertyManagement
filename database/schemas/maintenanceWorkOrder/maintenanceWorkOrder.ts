import * as crypto from "crypto";
import dayjs from "dayjs";
import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {MaintenanceWorkOrderSchemaDef, maintenanceWorkOrderStatusValues, maintenanceWorkOrderTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/maintenanceWorkOrder.schema-def";
import {MaintenancePlanSimpleSnippet} from "../maintenancePlan/maintenancePlan.snippets";
import {AssetSimpleSnippet} from "../asset/asset.snippets";
import {EdificeSimpleSnippet} from "../edifice/edifice.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {maintenanceWorkOrderViews} from "./maintenanceWorkOrder.views";
import {applyMaintenanceWorkOrderIndexes} from "./maintenanceWorkOrder.indexes";

export interface IMaintenanceWorkOrder extends Document, IOwnershipPluginFields, ISoftDeletePluginFields {
    name: string;
    title: string;
    status?: string;
    [key: string]: any;
}

const MaintenanceWorkOrderSchema = new Schema<IMaintenanceWorkOrder>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true},

        plan: {type: SchemaTypes.ObjectId, ref: "MaintenancePlan", required: false, refAllowlist: MaintenancePlanSimpleSnippet},
        asset: {type: SchemaTypes.ObjectId, ref: "Asset", required: false, refAllowlist: AssetSimpleSnippet},
        edifice: {type: SchemaTypes.ObjectId, ref: "Edifice", required: false, refAllowlist: EdificeSimpleSnippet},
        title: {type: SchemaTypes.String, required: true, trim: true},
        type: {type: SchemaTypes.String, enum: [...maintenanceWorkOrderTypeValues], required: false, default: "preventive"},
        assignee: {type: SchemaTypes.ObjectId, ref: "Constructor", required: false, refAllowlist: ConstructorSimpleSnippet},
        costEstimate: {type: SchemaTypes.Decimal128, required: false},
        actualCost: {type: SchemaTypes.Decimal128, required: false},
        currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: false, refAllowlist: CurrencySimpleSnippet},
        linkedSnag: {type: SchemaTypes.ObjectId, ref: "Snag", required: false},
        dueDate: {type: SchemaTypes.Date, required: false},
        notes: {type: SchemaTypes.String, required: false},

        status: {
            type: SchemaTypes.String,
            enum: [...maintenanceWorkOrderStatusValues],
            required: false,
            default: "open",
            permissions: {self: {write: "no-permission"}, others: {write: "no-permission"}},
        },
    },
    {accessMode: "loose"},
);

MaintenanceWorkOrderSchema.pre("validate", function (next) {
    if (!this.name) {
        const date = dayjs().format("YYYYMMDD");
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        this.name = `MWO-${date}-${suffix}`;
    }
    next();
});

ownershipPlugin(MaintenanceWorkOrderSchema);
auditPlugin(MaintenanceWorkOrderSchema);
softDeletePlugin(MaintenanceWorkOrderSchema);
applyMaintenanceWorkOrderIndexes(MaintenanceWorkOrderSchema);

const MaintenanceWorkOrder = model<IMaintenanceWorkOrder>("MaintenanceWorkOrder", MaintenanceWorkOrderSchema, "maintenanceworkorders");
export default MaintenanceWorkOrder;

normalizeSchemaPermissions(MaintenanceWorkOrder);
addModelData(MaintenanceWorkOrder, maintenanceWorkOrderViews);
validateSchemaDefAgainstMongoose(MaintenanceWorkOrderSchema, MaintenanceWorkOrderSchemaDef, "MaintenanceWorkOrder", ["name", "status"]);
