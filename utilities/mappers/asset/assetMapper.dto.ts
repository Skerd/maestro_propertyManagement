import type {Asset} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/asset.dto";
import type {IAsset} from "../../../database/schemas/asset/asset";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function assetToDTO(doc: IAsset | any): Asset {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const out: any = {
        _id: doc._id.toString(), name: doc.name, title: doc.title,
        category: doc.category ?? undefined, manufacturer: doc.manufacturer ?? undefined, serial: doc.serial ?? undefined,
        lifecycleStatus: doc.lifecycleStatus, notes: doc.notes ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
    if (doc.edifice) out.edifice = mapPopulatedRef(doc.edifice);
    if (doc.unit) out.unit = mapPopulatedRef(doc.unit);
    if (doc.warranty) out.warranty = mapPopulatedRef(doc.warranty);
    for (const [k, v] of Object.entries(raw)) {
        if (["_id","name","title","category","manufacturer","serial","lifecycleStatus","notes","edifice","unit","warranty","company","createdAt","updatedAt","deletedAt","__v","createdBy","updatedBy","deletedBy"].includes(k)) continue;
        if (v instanceof Date) out[k] = v.toISOString();
        else if (v && typeof v === "object" && (v as any)._bsontype === "ObjectID") out[k] = (v as any).toString();
        else if (v && typeof v === "object" && (v as any)._id) out[k] = mapPopulatedRef(v);
        else out[k] = v;
    }
    return out as Asset;
}
export function assetsToDTO(docs: IAsset[]): Asset[] { return docs.map(assetToDTO); }
