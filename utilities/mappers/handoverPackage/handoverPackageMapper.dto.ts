import type {HandoverPackage, HandoverPackageItem} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.dto";
import type {IHandoverPackage} from "../../../database/schemas/handoverPackage/handoverPackage";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapItem(item: IHandoverPackage["items"][number]): HandoverPackageItem {
    return {
        _id: item._id?.toString(),
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance,
        completed: item.completed,
        completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : undefined,
        completedBy: mapPopulatedSimpleUser(item.completedBy),
    };
}

export function handoverPackageToDTO(doc: IHandoverPackage): HandoverPackage {
    const raw = doc.toObject?.({virtuals: false}) ?? doc;
    const items = Array.isArray(raw.items) ? raw.items.map(mapItem) : [];
    return {
        _id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        description: doc.description ?? undefined,
        notes: doc.notes ?? undefined,
        status: doc.status === "ready" ? "in_progress" : doc.status,
        project: mapPopulatedRef(doc.project)!,
        edifice: mapPopulatedRef(doc.edifice),
        floor: mapPopulatedRef(doc.floor),
        unit: mapPopulatedRef(doc.unit)!,
        items,
        media: doc.media?.length ? doc.media.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
    };
}

export function handoverPackagesToDTO(docs: IHandoverPackage[]): HandoverPackage[] {
    return docs.map(handoverPackageToDTO);
}
