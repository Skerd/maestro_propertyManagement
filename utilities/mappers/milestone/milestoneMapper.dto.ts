import type {Milestone, MilestoneRef} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/milestone.dto";
import type {IMilestone} from "../../../database/schemas/milestone/milestone";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapMilestoneRef(ref: any): MilestoneRef | undefined {
    if (!ref) return undefined;
    return {
        _id: ref._id?.toString(),
        name: ref.name ?? undefined,
        title: ref.title ?? undefined,
    };
}

export function milestoneToDTO(doc: IMilestone | any): Milestone {
    return {
        _id:           doc._id.toString(),
        name:          doc.name,
        project:       mapPopulatedRef(doc.project)!,
        edifice:       mapPopulatedRef(doc.edifice),
        title:         doc.title,
        description:   doc.description ?? undefined,
        status:        doc.status,
        plannedStart:  doc.plannedStart instanceof Date ? doc.plannedStart.toISOString() : doc.plannedStart ?? undefined,
        plannedEnd:    doc.plannedEnd instanceof Date ? doc.plannedEnd.toISOString() : doc.plannedEnd ?? undefined,
        actualStart:   doc.actualStart instanceof Date ? doc.actualStart.toISOString() : doc.actualStart ?? undefined,
        actualEnd:     doc.actualEnd instanceof Date ? doc.actualEnd.toISOString() : doc.actualEnd ?? undefined,
        weightPercent: typeof doc.weightPercent === "number" ? doc.weightPercent : undefined,
        predecessors:  Array.isArray(doc.predecessors) && doc.predecessors.length
            ? doc.predecessors.map(mapMilestoneRef).filter(Boolean) as MilestoneRef[]
            : undefined,
        notes:         doc.notes ?? undefined,
        media:         doc.media?.length ? doc.media.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function milestonesToDTO(docs: IMilestone[]): Milestone[] {
    return docs.map(milestoneToDTO);
}
