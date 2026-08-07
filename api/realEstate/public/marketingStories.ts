import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import {storyService} from "../../../database/schemas/story/story.service";
import {storyTypeService} from "../../../database/schemas/storyType/storyType.service";
import {projectService} from "../../../database/schemas/project/project.service";
import {
    marketingStoriesFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingStories/marketingStories.form.validator";
import {
    marketingStorySingleFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingStories/marketingStorySingle.form.validator";
import type {
    MarketingMagazine,
    MarketingStoriesFormResponseType,
    MarketingStoryItem,
    MarketingStoryTypeItem,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingStories/marketingStories.form.response.type";
import type {
    MarketingStorySingleFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingStories/marketingStorySingle.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {
    marketingMediaUrl,
    marketingMediaUrls,
} from "../../../utilities/mappers/marketing/marketing.mapper";

const DEFAULT_LIMIT = 24;

const router = Router();

type MarketingStoriesParams = NotAuthenticatedMWType & {
    projectId?: string;
    edificeId?: string;
    unitId?: string;
    storyTypeId?: string;
    limit?: number;
};

type MarketingStorySingleParams = NotAuthenticatedMWType & {
    storyId: string;
};

function toIso(value: unknown): string | undefined {
    if (!value) return undefined;
    try {
        return new Date(value as string | number | Date).toISOString();
    } catch {
        return undefined;
    }
}

function truncateExcerpt(content: string, max = 180): string {
    const cleaned = content.replace(/\s+/g, " ").trim();
    if (cleaned.length <= max) return cleaned;
    return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function mapStory(story: any): MarketingStoryItem {
    const excerpt = story.excerpt?.trim()
        ? story.excerpt.trim()
        : truncateExcerpt(String(story.content ?? ""));

    const storyType = story.storyType;
    return {
        _id: objectIdToString(story._id),
        title: story.title,
        content: story.content,
        excerpt,
        mainImage: marketingMediaUrl(story.mainImage),
        imageGallery: marketingMediaUrls(story.imageGallery),
        videoGallery: marketingMediaUrls(story.videoGallery),
        publishedAt: toIso(story.publishedAt),
        sortOrder: story.sortOrder ?? 0,
        projectId: story.project ? objectIdToString(story.project._id ?? story.project) : undefined,
        projectName: story.project?.name,
        edificeId: story.edifice ? objectIdToString(story.edifice._id ?? story.edifice) : undefined,
        edificeName: story.edifice?.name,
        unitId: story.unit ? objectIdToString(story.unit._id ?? story.unit) : undefined,
        unitName: story.unit?.name ?? story.unit?.unitNumber,
        storyTypeId: storyType ? objectIdToString(storyType._id ?? storyType) : undefined,
        storyTypeName: storyType?.name,
        storyTypeSlug: storyType?.slug,
    };
}

function mapStoryType(doc: any): MarketingStoryTypeItem {
    return {
        _id: objectIdToString(doc._id),
        name: doc.name,
        slug: doc.slug,
        sortOrder: doc.sortOrder ?? 0,
    };
}

function mapMagazine(project: any): MarketingMagazine | undefined {
    if (!project) return undefined;
    const title = typeof project.magazineTitle === "string" ? project.magazineTitle.trim() : "";
    const description =
        typeof project.magazineDescription === "string" ? project.magazineDescription.trim() : "";
    const fileUrl = marketingMediaUrl(project.magazineFile);
    if (!title && !description && !fileUrl) return undefined;
    return {
        title: title || undefined,
        description: description || undefined,
        fileUrl,
    };
}

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingStoriesFormSchema),
    asyncHandler(marketingStories),
);

router.post(
    "/single",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingStorySingleFormSchema),
    asyncHandler(marketingStorySingle),
);

async function marketingStories(
    params: MarketingStoriesParams,
): Promise<MarketingStoriesFormResponseType> {
    const {origin, languageCode, logger, projectId, edificeId, unitId, storyTypeId, limit} = params;
    logger.start("Loading marketing stories...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const filter: Record<string, any> = {
        company: company._id,
        deletedAt: null,
        published: true,
    };

    if (projectId) filter.project = new ObjectId(projectId);
    if (edificeId) filter.edifice = new ObjectId(edificeId);
    if (unitId) filter.unit = new ObjectId(unitId);
    if (storyTypeId) filter.storyType = new ObjectId(storyTypeId);

    const [stories, storyTypes, project] = await Promise.all([
        storyService.find(
            filter,
            {logger, languageCode},
            ["mainImage", "imageGallery", "videoGallery", "project", "edifice", "unit", "storyType"],
            undefined,
            {sortOrder: 1, publishedAt: -1, createdAt: -1},
            Math.min(limit ?? DEFAULT_LIMIT, 50),
        ),
        storyTypeService.find(
            {company: company._id, deletedAt: null},
            {logger, languageCode},
            undefined,
            undefined,
            {sortOrder: 1, name: 1},
            100,
        ),
        projectId
            ? projectService.findOne(
                  {_id: new ObjectId(projectId), company: company._id, deletedAt: null},
                  {logger, languageCode},
                  ["magazineFile"],
              )
            : Promise.resolve(null),
    ]);

    const mapped = stories.map(mapStory);

    logger.finish(`Loaded ${mapped.length} marketing stories`);
    return {
        stories: mapped,
        total: mapped.length,
        storyTypes: storyTypes.map(mapStoryType),
        magazine: mapMagazine(project),
    };
}

async function marketingStorySingle(
    params: MarketingStorySingleParams,
): Promise<MarketingStorySingleFormResponseType> {
    const {origin, languageCode, logger, storyId} = params;
    logger.start(`Loading marketing story [${storyId}]...`);

    const company = await resolveMarketingCompany(origin, languageCode);
    const story = await storyService.findOne(
        {
            _id: new ObjectId(storyId),
            company: company._id,
            deletedAt: null,
            published: true,
        },
        {logger, languageCode},
        ["mainImage", "imageGallery", "videoGallery", "project", "edifice", "unit", "storyType"],
    );

    if (!story) {
        throw apiValidationException("story_not_found", "storyId", storyId, languageCode);
    }

    logger.finish(`Loaded marketing story ${storyId}`);
    return {story: mapStory(story)};
}

export const basePath = "/api/realEstate/marketingStories";
module.exports = {router, basePath};
