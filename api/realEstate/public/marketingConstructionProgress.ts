import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {projectService} from "../../../database/schemas/project/project.service";
import {milestoneService} from "../../../database/schemas/milestone/milestone.service";
import {constructionUpdateService} from "../../../database/schemas/constructionUpdate/constructionUpdate.service";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {marketingMediaUrls} from "../../../utilities/mappers/marketing/marketing.mapper";
import {
    marketingConstructionProgressFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingConstructionProgress/marketingConstructionProgress.form.validator";
import type {
    MarketingConstructionProgressFormResponseType,
    MarketingMilestone,
    MarketingConstructionUpdate,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingConstructionProgress/marketingConstructionProgress.form.response.type";

const router = Router();

type MarketingConstructionProgressParams = NotAuthenticatedMWType & {
    projectId: string;
};

const UPDATES_LIMIT = 6;

/** Contribution of one milestone toward overall completion, by status. */
function milestoneCompletionFactor(status: string | undefined): number {
    switch (status) {
        case "completed": return 1;
        case "in_progress":
        case "delayed": return 0.5;
        default: return 0;
    }
}

function toIso(v: unknown): string | undefined {
    if (!v) return undefined;
    try {
        return new Date(v as string | number | Date).toISOString();
    } catch {
        return undefined;
    }
}

router.post(
    "/single",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingConstructionProgressFormSchema),
    asyncHandler(marketingConstructionProgress),
);

async function marketingConstructionProgress(
    params: MarketingConstructionProgressParams,
): Promise<MarketingConstructionProgressFormResponseType> {
    const {origin, languageCode, logger, projectId} = params;
    logger.start(`Loading marketing construction progress [${projectId}]...`);

    const company = await resolveMarketingCompany(origin, languageCode);
    const projectObjectId = new ObjectId(projectId);

    const project = await projectService.findOne(
        {_id: projectObjectId, company: company._id, deletedAt: null},
        {logger, languageCode},
    );
    if (!project) {
        throw apiValidationException("project_not_found", "projectId", projectId, languageCode);
    }

    const milestoneDocs = await milestoneService.find(
        {project: projectObjectId, company: company._id, status: {$ne: "cancelled"}, deletedAt: null},
        {logger, languageCode},
        [],
        "title status plannedStart plannedEnd actualStart actualEnd weightPercent",
        {plannedStart: 1},
        200,
    );

    const milestones: MarketingMilestone[] = (milestoneDocs as any[]).map((m) => ({
        id: m._id.toString(),
        title: m.title ?? "",
        status: m.status ?? "planned",
        plannedStart: toIso(m.plannedStart),
        plannedEnd: toIso(m.plannedEnd),
        actualStart: toIso(m.actualStart),
        actualEnd: toIso(m.actualEnd),
        weightPercent: m.weightPercent ?? undefined,
    }));

    // Weighted completion: explicit weightPercent when present, equal weights otherwise.
    let overallPercent: number | null = null;
    if (milestoneDocs.length > 0) {
        const hasWeights = (milestoneDocs as any[]).some((m) => m.weightPercent != null && m.weightPercent > 0);
        let totalWeight = 0;
        let earned = 0;
        for (const m of milestoneDocs as any[]) {
            const weight = hasWeights ? (m.weightPercent ?? 0) : 1;
            totalWeight += weight;
            earned += weight * milestoneCompletionFactor(m.status);
        }
        overallPercent = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : null;
    }

    const updateDocs = await constructionUpdateService.find(
        {project: projectObjectId, company: company._id, deletedAt: null},
        {logger, languageCode},
        [{path: "photos", select: "_id"}],
        "title description progressPercent updateDate photos",
        {updateDate: -1},
        UPDATES_LIMIT,
    );

    const updates: MarketingConstructionUpdate[] = (updateDocs as any[]).map((u) => ({
        id: u._id.toString(),
        title: u.title ?? "",
        description: u.description ?? undefined,
        progressPercent: u.progressPercent ?? 0,
        updateDate: toIso(u.updateDate) ?? "",
        photos: marketingMediaUrls(u.photos),
    }));

    const latestUpdatePercent = updates.length > 0 ? updates[0].progressPercent : null;

    logger.finish(`Loaded marketing construction progress [${projectId}]`);
    return {
        progress: {overallPercent, latestUpdatePercent, milestones, updates},
    };
}

export const basePath = "/api/realEstate/marketingConstructionProgress";
module.exports = {router, basePath};
