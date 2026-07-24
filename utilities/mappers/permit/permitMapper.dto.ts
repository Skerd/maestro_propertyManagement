import type {Permit} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/permit.dto";
import type {IPermit} from "../../../database/schemas/permit/permit";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function permitToDTO(doc: IPermit | any): Permit {
    return {
        _id:             doc._id.toString(),
        name:            doc.name,
        project:         mapPopulatedRef(doc.project),
        edifice:         mapPopulatedRef(doc.edifice),
        title:           doc.title,
        permitType:      doc.permitType,
        authority:       doc.authority ?? undefined,
        referenceNumber: doc.referenceNumber ?? undefined,
        description:     doc.description ?? undefined,
        notes:           doc.notes ?? undefined,
        status:          doc.status,
        submittedAt:     doc.submittedAt instanceof Date ? doc.submittedAt.toISOString() : doc.submittedAt ?? undefined,
        approvedAt:      doc.approvedAt instanceof Date ? doc.approvedAt.toISOString() : doc.approvedAt ?? undefined,
        expiresAt:       doc.expiresAt instanceof Date ? doc.expiresAt.toISOString() : doc.expiresAt ?? undefined,
        renewedAt:       doc.renewedAt instanceof Date ? doc.renewedAt.toISOString() : doc.renewedAt ?? undefined,
        media:           doc.media?.length ? doc.media.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function permitsToDTO(docs: IPermit[]): Permit[] {
    return docs.map(permitToDTO);
}
