import type {ScheduleTask} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/scheduleTask.dto";
import type {IScheduleTask} from "../../../database/schemas/scheduleTask/scheduleTask";
import {mapMedia, mapPopulatedRef, mapPopulatedSimpleUser} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapMilestoneRef(ref: any): {_id: string; name?: string; title?: string} | undefined {
    if (!ref) return undefined;
    return {
        _id: ref._id?.toString(),
        name: ref.name ?? undefined,
        title: ref.title ?? undefined,
    };
}

export function scheduleTaskToDTO(doc: IScheduleTask | any): ScheduleTask {
    return {
        _id:             doc._id.toString(),
        name:            doc.name,
        project:         mapPopulatedRef(doc.project)!,
        edifice:         mapPopulatedRef(doc.edifice),
        milestone:       mapMilestoneRef(doc.milestone),
        title:           doc.title,
        description:     doc.description ?? undefined,
        status:          doc.status,
        assignee:        mapPopulatedSimpleUser(doc.assignee),
        plannedStart:    doc.plannedStart instanceof Date ? doc.plannedStart.toISOString() : doc.plannedStart ?? undefined,
        plannedEnd:      doc.plannedEnd instanceof Date ? doc.plannedEnd.toISOString() : doc.plannedEnd ?? undefined,
        actualStart:     doc.actualStart instanceof Date ? doc.actualStart.toISOString() : doc.actualStart ?? undefined,
        actualEnd:       doc.actualEnd instanceof Date ? doc.actualEnd.toISOString() : doc.actualEnd ?? undefined,
        percentComplete: typeof doc.percentComplete === "number" ? doc.percentComplete : undefined,
        predecessors:    Array.isArray(doc.predecessors) ? doc.predecessors.map((p: any) => (p && p._id ? {_id: String(p._id), title: p.title} : String(p))) : undefined,
        dependencyType:  doc.dependencyType ?? undefined,
        lagDays:         typeof doc.lagDays === "number" ? doc.lagDays : undefined,
        bkpCode:         doc.bkpCode ?? undefined,
        notes:           doc.notes ?? undefined,
        media:           doc.media?.length ? doc.media.map(mapMedia) : undefined,
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function scheduleTasksToDTO(docs: IScheduleTask[]): ScheduleTask[] {
    return docs.map(scheduleTaskToDTO);
}
