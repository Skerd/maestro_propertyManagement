import type {ConstructionProgress} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.dto";
import type {IConstructionProgress} from "../../../database/schemas/constructionProgress/constructionProgress";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

const iso = (d: Date | string | undefined | null) => (d instanceof Date ? d.toISOString() : d ?? undefined);

export function constructionProgressToDTO(doc: IConstructionProgress): ConstructionProgress {
    return {
        _id:                    doc._id.toString(),
        name:                   doc.name,
        project:                mapPopulatedRef(doc.project),
        edifice:                mapPopulatedRef(doc.edifice),
        phase:                  doc.phase,
        progressPercent:        doc.progressPercent,
        updateDate:             iso(doc.updateDate) as string,
        title:                  doc.title,
        description:            doc.description ?? undefined,
        expectedCompletionDate: iso(doc.expectedCompletionDate),
        photos:                 doc.photos?.length ? doc.photos.map(mapMedia) : undefined,
        notifyClients:          doc.notifyClients ?? undefined,
        clientsNotifiedAt:      iso(doc.clientsNotifiedAt),
        clientsNotifiedCount:   doc.clientsNotifiedCount ?? undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc)
    };
}

export function constructionProgressesToDTO(docs: IConstructionProgress[]): ConstructionProgress[] {
    return docs.map(constructionProgressToDTO);
}
