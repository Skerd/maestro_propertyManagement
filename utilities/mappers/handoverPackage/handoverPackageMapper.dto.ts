import type {HandoverPackage, HandoverPackageItem} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.dto";
import type {HandoverConfigScopeValue} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";
import type {IHandoverPackage} from "../../../database/schemas/handoverPackage/handoverPackage";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {FloorSimpleSnippet} from "@propertyManagement/database/schemas/floor/floor.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
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
        project: mapSnippet<ProjectSimple>()(doc.project, ProjectSimpleSnippet)!,
        edifice: mapSnippet<EdificeSimple>()(doc.edifice, EdificeSimpleSnippet),
        floor: mapSnippet<FloorSimple>()(doc.floor, FloorSimpleSnippet),
        unit: mapSnippet<UnitSimple>()(doc.unit, UnitSimpleSnippet),
        items,
        media: doc.media?.length ? doc.media.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
    };
}

export function handoverPackagesToDTO(docs: IHandoverPackage[]): HandoverPackage[] {
    return docs.map(handoverPackageToDTO);
}
