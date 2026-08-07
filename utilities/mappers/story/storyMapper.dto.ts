import type {Story} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/story.dto";
import type {IStory} from "../../../database/schemas/story/story";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapUnitRef(ref: any): {_id: string; name: string; unitNumber?: string} | undefined {
    if (!ref) return undefined;
    return {
        _id: ref._id?.toString(),
        name: ref.name ?? "",
        unitNumber: ref.unitNumber ?? undefined,
    };
}

function toIso(value: unknown): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString();
    try {
        return new Date(value as string).toISOString();
    } catch {
        return undefined;
    }
}

export function storyToDTO(doc: IStory): Story {
    return {
        _id: doc._id.toString(),
        name: doc.name,
        project: mapPopulatedRef(doc.project)!,
        edifice: mapPopulatedRef(doc.edifice),
        unit: mapUnitRef(doc.unit),
        title: doc.title,
        content: doc.content,
        excerpt: doc.excerpt ?? undefined,
        mainImage: doc.mainImage ? mapMedia(doc.mainImage) : undefined,
        imageGallery: doc.imageGallery?.length ? doc.imageGallery.map(mapMedia) : undefined,
        videoGallery: doc.videoGallery?.length ? doc.videoGallery.map(mapMedia) : undefined,
        published: doc.published ?? true,
        publishedAt: toIso(doc.publishedAt),
        sortOrder: doc.sortOrder ?? 0,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function storiesToDTO(docs: IStory[]): Story[] {
    return docs.map(storyToDTO);
}
