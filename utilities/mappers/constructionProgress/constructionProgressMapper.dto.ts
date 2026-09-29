import type {ConstructionProgress} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.dto";
import type {IConstructionProgress} from "../../../database/schemas/constructionProgress/constructionProgress";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function constructionProgressToDTO(doc: IConstructionProgress): ConstructionProgress {
    return {
        _id:                    doc._id.toString(),
        name:                   doc.name,
        project:                mapSnippet<ProjectSimple>()(doc.project, ProjectSimpleSnippet)!,
        edifice:                mapSnippet<EdificeSimple>()(doc.edifice, EdificeSimpleSnippet),
        phase:                  doc.phase,
        progressPercent:        doc.progressPercent,
        updateDate:             doc.updateDate,
        title:                  doc.title,
        description:            doc.description ?? undefined,
        expectedCompletionDate: doc.expectedCompletionDate ?? undefined,
        photos:                 doc.photos?.length ? doc.photos.map(mapMedia) : undefined,
        notifyClients:          doc.notifyClients ?? undefined,
        clientsNotifiedAt:      doc.clientsNotifiedAt ?? undefined,
        clientsNotifiedCount:   doc.clientsNotifiedCount ?? undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc)
    };
}

export function constructionProgressesToDTO(docs: IConstructionProgress[]): ConstructionProgress[] {
    return docs.map(constructionProgressToDTO);
}
