import type {ClientSession} from "mongodb";
import {ObjectId} from "mongodb";
import {constructionPhaseIndex} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.constants";
import {type IConstructionProgress} from "@propertyManagement/database/schemas/constructionProgress/constructionProgress";
import {constructionProgressService} from "@propertyManagement/database/schemas/constructionProgress/constructionProgress.service";

type ProgressLike = Pick<IConstructionProgress, "phase" | "progressPercent">;

/** Most recent live report in a scope (project-wide, or one building). */
export async function findLatestConstructionProgress(
    scope: {company: ObjectId; project: ObjectId; edifice?: ObjectId | null},
    opts: {session?: ClientSession; excludeId?: ObjectId} = {},
): Promise<IConstructionProgress | null> {
    const filter: Record<string, unknown> = {company: scope.company, project: scope.project};
    if (scope.edifice) filter.edifice = scope.edifice;
    if (opts.excludeId) filter._id = {$ne: opts.excludeId};
    return constructionProgressService.findLatest(filter, opts.session);
}

/** True when `next` moved the works forward: a later phase, or a higher % in the same phase. */
export function isConstructionAdvance(previous: ProgressLike | null | undefined, next: ProgressLike): boolean {
    if (!previous) return true;
    const prevPhase = constructionPhaseIndex(previous.phase);
    const nextPhase = constructionPhaseIndex(next.phase);
    if (nextPhase !== prevPhase) return nextPhase > prevPhase;
    return (next.progressPercent ?? 0) > (previous.progressPercent ?? 0);
}
