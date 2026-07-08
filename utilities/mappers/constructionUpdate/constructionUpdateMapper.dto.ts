import type {ConstructionUpdate} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/constructionUpdate.dto";
import type {IConstructionUpdate} from "../../../database/schemas/constructionUpdate/constructionUpdate";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
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
