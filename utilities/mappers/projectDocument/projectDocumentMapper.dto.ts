import type {ProjectDocument} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/projectDocument.dto";
import type {IProjectDocument} from "../../../database/schemas/projectDocument/projectDocument";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapUnitRef(ref: any): {_id: string; name: string; unitNumber?: string} | undefined {
    if (!ref) return undefined;
    return {
        _id: ref._id?.toString(),
        name: ref.name,
        unitNumber: ref.unitNumber ?? undefined,
    };
}

function mapSupersedesRef(ref: any): {_id: string; name?: string; title?: string; documentNumber?: string; revision?: string} | undefined {
    if (!ref) return undefined;
    return {
        _id: ref._id?.toString(),
        name: ref.name ?? undefined,
        title: ref.title ?? undefined,
        documentNumber: ref.documentNumber ?? undefined,
        revision: ref.revision ?? undefined,
    };
}

export function projectDocumentToDTO(doc: IProjectDocument | any): ProjectDocument {
    return {
        _id:             doc._id.toString(),
        name:            doc.name,
        project:         mapPopulatedRef(doc.project)!,
        edifice:         mapPopulatedRef(doc.edifice),
        floor:           mapPopulatedRef(doc.floor),
        unit:            mapUnitRef(doc.unit),
        title:           doc.title,
        documentNumber:  doc.documentNumber ?? undefined,
        discipline:      doc.discipline,
        documentType:    doc.documentType,
        revision:        doc.revision ?? undefined,
        revisionDate:    doc.revisionDate instanceof Date ? doc.revisionDate.toISOString() : doc.revisionDate ?? undefined,
        description:     doc.description ?? undefined,
        notes:           doc.notes ?? undefined,
        media:           doc.media?.length ? doc.media.map(mapMedia) : undefined,
        supersedes:      mapSupersedesRef(doc.supersedes),
        status:          doc.status,
        isAsBuilt:       doc.isAsBuilt ?? undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
    };
}

export function projectDocumentsToDTO(docs: IProjectDocument[]): ProjectDocument[] {
    return docs.map(projectDocumentToDTO);
}
