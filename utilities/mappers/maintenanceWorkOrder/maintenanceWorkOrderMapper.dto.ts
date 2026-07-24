import type {MaintenanceWorkOrder} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/maintenanceWorkOrder.dto";
import type {IMaintenanceWorkOrder} from "../../../database/schemas/maintenanceWorkOrder/maintenanceWorkOrder";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
function dec(v: any): number | undefined { if (v == null) return undefined; if (typeof v === "number") return v; if (typeof v?.toString === "function") return Number(v.toString()); return undefined; }
export function maintenanceWorkOrderToDTO(doc: IMaintenanceWorkOrder | any): MaintenanceWorkOrder {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {_id: doc._id.toString(), name: doc.name, title: doc.title, type: doc.type ?? undefined, notes: doc.notes ?? undefined, status: doc.status, ...mapOwnershipToDTO(doc)};
    if (doc.plan) out.plan = mapPopulatedRef(doc.plan);
    if (doc.asset) out.asset = mapPopulatedRef(doc.asset);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    if (doc.assignee) out.assignee = mapPopulatedRef(doc.assignee);
    if (doc.currency) out.currency = mapPopulatedRef(doc.currency);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","type","notes","status","plan","asset","edifice","assignee","currency","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v && typeof v === "object" && (v as any)._bsontype === "Decimal128") out[k] = dec(v);
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as MaintenanceWorkOrder;
}
export function maintenanceWorkOrdersToDTO(docs: IMaintenanceWorkOrder[]): MaintenanceWorkOrder[] { return docs.map(maintenanceWorkOrderToDTO); }
