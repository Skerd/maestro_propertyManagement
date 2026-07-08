import type {Snag} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.dto";
import type {ISnag} from "../../../database/schemas/snag/snag";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function snagToDTO(doc: ISnag | any): Snag {
    return {
        _id:         doc._id.toString(),
        name:        doc.name,
        unit:        mapPopulatedRef(doc.unit),
        title:       doc.title,
        description: doc.description ?? undefined,
        location:    doc.location ?? undefined,
        status:      doc.status,
        severity:    doc.severity,
        reportedBy:  mapPopulatedSimpleUser(doc.reportedBy),
        assignedTo:  mapPopulatedSimpleUser(doc.assignedTo),
        dueDate:     doc.dueDate instanceof Date ? doc.dueDate.toISOString() : doc.dueDate ?? undefined,
        resolvedAt:  doc.resolvedAt instanceof Date ? doc.resolvedAt.toISOString() : doc.resolvedAt ?? undefined,
        photos:      doc.photos?.length ? doc.photos.map(mapMedia) : undefined,
        notes:       doc.notes ?? undefined,
        ...mapOwnershipToDTO(doc),
    };
}

export function snagsToDTO(docs: ISnag[]): Snag[] {
    return docs.map(snagToDTO);
}
