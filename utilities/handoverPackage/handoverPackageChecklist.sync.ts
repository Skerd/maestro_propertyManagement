import {ObjectId} from "mongodb";
import type {HandoverConfigScopeValue} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";

export type EffectiveHandoverItem = {
    sourcePackageId: string;
    sourceItemId: string;
    sourceScope: HandoverConfigScopeValue;
    name: string;
    description?: string;
    instructions?: string;
    importance?: string;
};

export type SaleHandoverChecklistRow = {
    _id?: ObjectId | string;
    sourcePackageId?: ObjectId | string;
    sourceItemId?: ObjectId | string;
    sourceScope?: HandoverConfigScopeValue | "retained";
    name?: string;
    description?: string;
    instructions?: string;
    importance?: string;
    completed?: boolean;
    completedAt?: Date;
    completedBy?: ObjectId;
    retained?: boolean;
};

export type ConfigItemLike = {
    _id?: ObjectId | string;
    name?: string;
    description?: string;
    instructions?: string;
    importance?: string;
    completed?: boolean;
    completedAt?: Date;
    completedBy?: ObjectId;
};

export type ConfigLike = {
    _id?: ObjectId | string;
    items?: ConfigItemLike[];
};

export type ResolvedHandoverConfigs = {
    project?: ConfigLike | null;
    edifice?: ConfigLike | null;
    floor?: ConfigLike | null;
    unit?: ConfigLike | null;
};

const SCOPE_ORDER = ["project", "edifice", "floor", "unit"] as const;

export function idString(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value === "string" && value.length > 0) return value;
    if (value instanceof ObjectId) return value.toString();
    if (typeof value === "object" && value !== null && "_id" in value) {
        return idString((value as {_id: unknown})._id);
    }
    return undefined;
}

export function concatenateEffectiveItems(configs: ResolvedHandoverConfigs): EffectiveHandoverItem[] {
    const out: EffectiveHandoverItem[] = [];
    for (const scope of SCOPE_ORDER) {
        const pkg = configs[scope];
        if (!pkg) continue;
        const packageId = idString(pkg._id);
        if (!packageId) continue;
        for (const item of pkg.items ?? []) {
            const sourceItemId = idString(item._id);
            if (!sourceItemId || !item.name) continue;
            out.push({
                sourcePackageId: packageId,
                sourceItemId,
                sourceScope: scope,
                name: item.name,
                description: item.description,
                instructions: item.instructions,
                importance: item.importance,
            });
        }
    }
    return out;
}

export function seedChecklistFromLegacyConfigItems(configs: ResolvedHandoverConfigs): SaleHandoverChecklistRow[] {
    const seeded: SaleHandoverChecklistRow[] = [];
    for (const scope of SCOPE_ORDER) {
        const pkg = configs[scope];
        if (!pkg) continue;
        const packageId = idString(pkg._id);
        if (!packageId) continue;
        for (const item of pkg.items ?? []) {
            if (!item.completed) continue;
            const sourceItemId = idString(item._id);
            if (!sourceItemId || !item.name) continue;
            seeded.push({
                sourcePackageId: new ObjectId(packageId),
                sourceItemId: new ObjectId(sourceItemId),
                sourceScope: scope,
                name: item.name,
                description: item.description,
                instructions: item.instructions,
                importance: item.importance,
                completed: true,
                completedAt: item.completedAt,
                completedBy: item.completedBy,
                retained: false,
            });
        }
    }
    return seeded;
}

export function configHasLegacyCompletion(configs: ResolvedHandoverConfigs): boolean {
    return SCOPE_ORDER.some((scope) => {
        const pkg = configs[scope];
        return (pkg?.items ?? []).some((item) => item.completed === true || item.completedAt != null || item.completedBy != null);
    });
}

function asObjectId(value: string): ObjectId {
    return new ObjectId(value);
}

export function mergeSaleHandoverChecklist(
    existing: SaleHandoverChecklistRow[],
    live: EffectiveHandoverItem[],
): SaleHandoverChecklistRow[] {
    const remaining = existing.map((row) => ({row, used: false}));
    const next: SaleHandoverChecklistRow[] = [];

    for (const liveItem of live) {
        const bySourceId = remaining.find((entry) =>
            !entry.used && idString(entry.row.sourceItemId) === liveItem.sourceItemId,
        );
        if (bySourceId) {
            bySourceId.used = true;
            next.push({
                ...bySourceId.row,
                sourcePackageId: asObjectId(liveItem.sourcePackageId),
                sourceItemId: asObjectId(liveItem.sourceItemId),
                sourceScope: liveItem.sourceScope,
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
            && entry.row.name === liveItem.name
            && entry.row.sourceScope === liveItem.sourceScope,
        );
        if (retainedMatch) {
            retainedMatch.used = true;
            next.push({
                ...retainedMatch.row,
                sourcePackageId: asObjectId(liveItem.sourcePackageId),
                sourceItemId: asObjectId(liveItem.sourceItemId),
                sourceScope: liveItem.sourceScope,
                name: liveItem.name,
                description: liveItem.description,
                instructions: liveItem.instructions,
                importance: liveItem.importance,
                retained: false,
            });
            continue;
        }

        next.push({
            sourcePackageId: asObjectId(liveItem.sourcePackageId),
            sourceItemId: asObjectId(liveItem.sourceItemId),
            sourceScope: liveItem.sourceScope,
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

export function isHandoverChecklistComplete(
    items: {completed?: boolean; retained?: boolean}[],
    hasConfigs: boolean,
): boolean {
    if (!hasConfigs) return false;
    return items.filter((item) => !item.retained).every((item) => !!item.completed);
}

export function checklistRowsChanged(before: SaleHandoverChecklistRow[], after: SaleHandoverChecklistRow[]): boolean {
    if (before.length !== after.length) return true;
    return JSON.stringify(stableRow(before)) !== JSON.stringify(stableRow(after));
}

function stableRow(rows: SaleHandoverChecklistRow[]) {
    return rows.map((row) => ({
        _id: idString(row._id),
        sourcePackageId: idString(row.sourcePackageId),
        sourceItemId: idString(row.sourceItemId),
        sourceScope: row.sourceScope,
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

export function applyHandoverItemPatches(
    existing: SaleHandoverChecklistRow[],
    patches: {_id: string; completed: boolean}[],
    userId: string,
): SaleHandoverChecklistRow[] {
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
