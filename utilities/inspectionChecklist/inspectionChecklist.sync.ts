import {ObjectId} from "mongodb";

export type EffectiveInspectionItem = {
    sourceTemplateId: string;
    sourceItemId: string;
    name: string;
    description?: string;
    instructions?: string;
    importance?: string;
};

export type InspectionChecklistRow = {
    _id?: ObjectId | string;
    sourceTemplateId?: ObjectId | string;
    sourceItemId?: ObjectId | string;
    name?: string;
    description?: string;
    instructions?: string;
    importance?: string;
    completed?: boolean;
    completedAt?: Date;
    completedBy?: ObjectId;
    retained?: boolean;
};

export type TemplateItemLike = {
    _id?: ObjectId | string;
    name?: string;
    description?: string;
    instructions?: string;
    importance?: string;
};

export type TemplateLike = {
    _id?: ObjectId | string;
    items?: TemplateItemLike[];
};

export function idString(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value === "string" && value.length > 0) return value;
    if (value instanceof ObjectId) return value.toString();
    if (typeof value === "object" && value !== null && "_id" in value) {
        return idString((value as {_id: unknown})._id);
    }
    return undefined;
}

export function isInspectionChecklistLocked(status?: string): boolean {
    return status === "completed" || status === "cancelled";
}

export function concatenateTemplateItems(template: TemplateLike | null | undefined): EffectiveInspectionItem[] {
    if (!template) return [];
    const templateId = idString(template._id);
    if (!templateId) return [];
    const out: EffectiveInspectionItem[] = [];
    for (const item of template.items ?? []) {
        const sourceItemId = idString(item._id);
        if (!sourceItemId || !item.name) continue;
        out.push({
            sourceTemplateId: templateId,
            sourceItemId,
            name: item.name,
            description: item.description,
            instructions: item.instructions,
            importance: item.importance,
        });
    }
    return out;
}

function asObjectId(value: string): ObjectId {
    return new ObjectId(value);
}

export function mergeInspectionChecklist(
    existing: InspectionChecklistRow[],
    live: EffectiveInspectionItem[],
): InspectionChecklistRow[] {
    const remaining = existing.map((row) => ({row, used: false}));
    const next: InspectionChecklistRow[] = [];

    for (const liveItem of live) {
        const bySourceId = remaining.find((entry) =>
            !entry.used && idString(entry.row.sourceItemId) === liveItem.sourceItemId,
        );
        if (bySourceId) {
            bySourceId.used = true;
            next.push({
                ...bySourceId.row,
                sourceTemplateId: asObjectId(liveItem.sourceTemplateId),
                sourceItemId: asObjectId(liveItem.sourceItemId),
                name: liveItem.name,
                description: liveItem.description,
                instructions: liveItem.instructions,
                importance: liveItem.importance,
                retained: false,
            });
            continue;
        }

        const retainedMatch = remaining.find((entry) =>
            !entry.used
            && entry.row.retained
            && entry.row.completed
            && entry.row.name === liveItem.name,
        );
        if (retainedMatch) {
            retainedMatch.used = true;
            next.push({
                ...retainedMatch.row,
                sourceTemplateId: asObjectId(liveItem.sourceTemplateId),
                sourceItemId: asObjectId(liveItem.sourceItemId),
                name: liveItem.name,
                description: liveItem.description,
                instructions: liveItem.instructions,
                importance: liveItem.importance,
                retained: false,
            });
            continue;
        }

        next.push({
            sourceTemplateId: asObjectId(liveItem.sourceTemplateId),
            sourceItemId: asObjectId(liveItem.sourceItemId),
            name: liveItem.name,
            description: liveItem.description,
            instructions: liveItem.instructions,
            importance: liveItem.importance,
            completed: false,
            retained: false,
        });
    }

    for (const entry of remaining) {
        if (entry.used) continue;
        if (!entry.row.completed) continue;
        next.push({
            ...entry.row,
            retained: true,
        });
    }

    return next;
}

export function isInspectionChecklistComplete(items: {completed?: boolean; retained?: boolean}[]): boolean {
    return items.filter((item) => !item.retained).every((item) => !!item.completed);
}

export function checklistRowsChanged(before: InspectionChecklistRow[], after: InspectionChecklistRow[]): boolean {
    if (before.length !== after.length) return true;
    return JSON.stringify(stableRow(before)) !== JSON.stringify(stableRow(after));
}

function stableRow(rows: InspectionChecklistRow[]) {
    return rows.map((row) => ({
        _id: idString(row._id),
        sourceTemplateId: idString(row.sourceTemplateId),
        sourceItemId: idString(row.sourceItemId),
        name: row.name,
        description: row.description,
        instructions: row.instructions,
        importance: row.importance,
        completed: !!row.completed,
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : undefined,
        completedBy: idString(row.completedBy),
        retained: !!row.retained,
    }));
}

export function applyInspectionItemPatches(
    existing: InspectionChecklistRow[],
    patches: {_id: string; completed: boolean}[],
    userId: string,
): InspectionChecklistRow[] {
    const next = existing.map((item) => ({...item}));
    for (const patch of patches) {
        const target = next.find((item) => item._id != null && String(item._id) === patch._id);
        if (!target) continue;
        if (target.retained && !patch.completed) continue;
        if (patch.completed && !target.completed) {
            target.completed = true;
            target.completedAt = new Date();
            target.completedBy = new ObjectId(userId);
        } else if (!patch.completed && target.completed) {
            target.completed = false;
            target.completedAt = undefined;
            target.completedBy = undefined;
        }
    }
    return next;
}

export function seedChecklistFromTemplate(template: TemplateLike): InspectionChecklistRow[] {
    return concatenateTemplateItems(template).map((item) => ({
        sourceTemplateId: asObjectId(item.sourceTemplateId),
        sourceItemId: asObjectId(item.sourceItemId),
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance,
        completed: false,
        retained: false,
    }));
}
