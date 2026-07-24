import type {MaintenancePlan} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/maintenancePlan.dto";
import type {IMaintenancePlan} from "../../../database/schemas/maintenancePlan/maintenancePlan";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
export function maintenancePlanToDTO(doc: IMaintenancePlan | any): MaintenancePlan {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {_id: doc._id.toString(), name: doc.name, title: doc.title, planType: doc.planType ?? undefined, responsibleParty: doc.responsibleParty ?? undefined, active: doc.active, notes: doc.notes ?? undefined, ...mapOwnershipToDTO(doc)};
    if (doc.asset) out.asset = mapPopulatedRef(doc.asset);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","planType","responsibleParty","active","notes","asset","edifice","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as MaintenancePlan;
}
export function maintenancePlansToDTO(docs: IMaintenancePlan[]): MaintenancePlan[] { return docs.map(maintenancePlanToDTO); }
