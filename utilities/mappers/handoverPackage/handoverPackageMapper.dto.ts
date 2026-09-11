import type {HandoverPackage, HandoverPackageItem} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.dto";
import type {HandoverConfigScopeValue} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";
import type {IHandoverPackage} from "../../../database/schemas/handoverPackage/handoverPackage";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function hasRef(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === "string") return value.length > 0;
    if (typeof value === "object" && "_id" in value) return (value as {_id: unknown})._id != null;
    return true;
}

export function handoverPackageScope(doc: IHandoverPackage): HandoverConfigScopeValue {
    if (hasRef(doc.unit)) return "unit";
    if (hasRef(doc.floor)) return "floor";
    if (hasRef(doc.edifice)) return "edifice";
    return "project";
}

function mapItem(item: { _id?: {toString(): string}; name: string; description?: string; instructions?: string; importance?: HandoverPackageItem["importance"] }): HandoverPackageItem {
    return {
        _id: item._id?.toString(),
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance,
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
        scope: handoverPackageScope(doc),
        project: mapPopulatedRef(doc.project)!,
        edifice: mapPopulatedRef(doc.edifice),
        floor: mapPopulatedRef(doc.floor),
        unit: mapPopulatedRef(doc.unit),
        items,
        media: doc.media?.length ? doc.media.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
    };
}

export function handoverPackagesToDTO(docs: IHandoverPackage[]): HandoverPackage[] {
    return docs.map(handoverPackageToDTO);
}
