import type {Story} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/story.dto";
import type {IStory} from "../../../database/schemas/story/story";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {StoryTypeSimple} from "armonia/src/modules/propertyManagement/dto/storyType.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {StoryTypeSimpleSnippet} from "@propertyManagement/database/schemas/storyType/storyType.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

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
        project: mapSnippet<ProjectSimple>()(doc.project, ProjectSimpleSnippet)!,
        storyType: mapSnippet<StoryTypeSimple>()(doc.storyType, StoryTypeSimpleSnippet),
        edifice: mapSnippet<EdificeSimple>()(doc.edifice, EdificeSimpleSnippet),
        unit: mapSnippet<UnitSimple>()(doc.unit, UnitSimpleSnippet),
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
