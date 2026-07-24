import type {BimModel} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/bimModel.dto";
import type {IBimModel} from "../../../database/schemas/bimModel/bimModel";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
export function bimModelToDTO(doc: IBimModel | any): BimModel {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {_id: doc._id.toString(), name: doc.name, title: doc.title, version: doc.version ?? undefined, importStatus: doc.importStatus, notes: doc.notes ?? undefined, ...mapOwnershipToDTO(doc)};
    if (doc.project) out.project = mapPopulatedRef(doc.project);
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","version","importStatus","notes","project","edifice","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as BimModel;
}
export function bimModelsToDTO(docs: IBimModel[]): BimModel[] { return docs.map(bimModelToDTO); }
