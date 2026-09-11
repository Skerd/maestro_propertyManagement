import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import type {Inspection as InspectionData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.dto";
import type {IInspection} from "../../database/schemas/inspection/inspection";
import {inspectionService} from "../../database/schemas/inspection/inspection.service";
import {inspectionChecklistTemplateService} from "../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate.service";
import {inspectionToDTO} from "../mappers/inspection/inspectionMapper.dto";
import {
    applyInspectionItemPatches,
    checklistRowsChanged,
    concatenateTemplateItems,
    idString,
    isInspectionChecklistComplete,
    isInspectionChecklistLocked,
    mergeInspectionChecklist,
    seedChecklistFromTemplate,
    type InspectionChecklistRow,
    type TemplateLike,
} from "./inspectionChecklist.sync";

export {
    applyInspectionItemPatches,
    concatenateTemplateItems,
    isInspectionChecklistComplete,
    isInspectionChecklistLocked,
    mergeInspectionChecklist,
    seedChecklistFromTemplate,
};

type CrudCtx = {
    session?: ClientSession;
    logger: unknown;
    languageCode: string;
};

function crudOpts(ctx: CrudCtx) {
    return {session: ctx.session, logger: ctx.logger as never, languageCode: ctx.languageCode};
}

function asObjectId(value: unknown): ObjectId | undefined {
    const s = idString(value);
    return s != null ? new ObjectId(s) : undefined;
}

export function toChecklistRows(items: IInspection["checklistItems"]): InspectionChecklistRow[] {
    return (items ?? []).map((item) => ({
        _id: asObjectId(item._id),
        sourceTemplateId: asObjectId(item.sourceTemplateId),
        sourceItemId: asObjectId(item.sourceItemId),
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance,
        completed: item.completed,
        completedAt: item.completedAt,
        completedBy: asObjectId(item.completedBy),
        retained: item.retained,
    }));
}

export async function loadChecklistTemplate(
    templateId: ObjectId | undefined,
    companyId: ObjectId,
    ctx: CrudCtx,
): Promise<TemplateLike | null> {
    if (!templateId) return null;
    return inspectionChecklistTemplateService.findOne(
        {_id: templateId, company: companyId},
        crudOpts(ctx),
    );
}

export async function syncInspectionChecklist(
    inspection: IInspection,
    companyId: ObjectId,
    ctx: CrudCtx,
): Promise<{inspection: IInspection; complete: boolean}> {
    const templateId = asObjectId(inspection.checklistTemplate);
    if (isInspectionChecklistLocked(inspection.status)) {
        return {
            inspection,
            complete: isInspectionChecklistComplete(inspection.checklistItems ?? []),
        };
    }

    const template = await loadChecklistTemplate(templateId, companyId, ctx);
    const existing = toChecklistRows(inspection.checklistItems);
    const live = concatenateTemplateItems(template);
    const next = mergeInspectionChecklist(existing, live);
    if (checklistRowsChanged(existing, next)) {
        await inspectionService.updateByIdOrThrow(
            inspection._id,
            {$set: {checklistItems: next}},
            crudOpts(ctx),
        );
        const fresh = await inspectionService.findById(inspection._id, crudOpts(ctx));
        inspection.checklistItems = fresh?.checklistItems ?? next.map((row) => ({
            ...row,
            name: row.name ?? "",
        }));
    }
    return {
        inspection,
        complete: isInspectionChecklistComplete(next),
    };
}

export async function inspectionsWithChecklistContext(
    inspections: IInspection[],
    params: Record<string, any>,
): Promise<InspectionData[]> {
    const {company, session, logger, languageCode} = params;
    const ctx = crudOpts({session, logger, languageCode});
    const enriched: InspectionData[] = [];
    for (const inspection of inspections) {
        const synced = await syncInspectionChecklist(inspection, company._id, ctx);
        const dto = inspectionToDTO(synced.inspection);
        enriched.push({
            ...dto,
            checklistComplete: synced.complete,
        });
    }
    return enriched;
}
