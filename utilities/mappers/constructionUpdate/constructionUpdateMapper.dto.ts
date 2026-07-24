import type {ConstructionUpdate} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/constructionUpdate.dto";
import type {IConstructionUpdate} from "../../../database/schemas/constructionUpdate/constructionUpdate";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";

function mapTitledRef(ref: any): {_id: string; name?: string; title?: string} | undefined {
    if (!ref) return undefined;
    return {
        _id: ref._id?.toString(),
        name: ref.name ?? undefined,
        title: ref.title ?? undefined,
    };
}
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function constructionUpdateToDTO(doc: IConstructionUpdate): ConstructionUpdate {
    return {
        _id:             doc._id.toString(),
        name:            doc.name,
        project:         mapPopulatedRef(doc.project),
        edifice:         mapPopulatedRef(doc.edifice),
        milestone:       mapTitledRef(doc.milestone),
        scheduleTask:    mapTitledRef(doc.scheduleTask),
        title:           doc.title,
        description:     doc.description ?? undefined,
        progressPercent: doc.progressPercent,
        updateDate:      doc.updateDate instanceof Date ? doc.updateDate.toISOString() : doc.updateDate,
        photos:          doc.photos?.length ? doc.photos.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc)
    };
}

export function constructionUpdatesToDTO(docs: IConstructionUpdate[]): ConstructionUpdate[] {
    return docs.map(constructionUpdateToDTO);
}
