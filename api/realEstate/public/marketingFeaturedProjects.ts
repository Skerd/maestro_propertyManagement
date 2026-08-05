import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import {projectService} from "../../../database/schemas/project/project.service";
import {
    marketingFeaturedProjectsFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingFeaturedProjects/marketingFeaturedProjects.form.validator";
import {
    MarketingFeaturedProjectsFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingFeaturedProjects/marketingFeaturedProjects.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {loadMarketingCatalogHierarchy} from "../../../utilities/marketing/marketingCatalogHierarchy.util";
import {mapMarketingProjectCatalogListItem} from "../../../utilities/mappers/marketing/marketingCatalog.mapper";

const FEATURED_LIMIT = 12;

const router = Router();

type MarketingFeaturedProjectsParams = NotAuthenticatedMWType;

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingFeaturedProjectsFormSchema),
    asyncHandler(marketingFeaturedProjects),
);

async function marketingFeaturedProjects(
    params: MarketingFeaturedProjectsParams,
): Promise<MarketingFeaturedProjectsFormResponseType> {
    const {origin, languageCode, logger} = params;
    logger.start("Loading marketing featured projects...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const companyId = company._id;

    const projects = await projectService.find(
        {
            company: companyId,
            deletedAt: null,
            featuredOnHomepage: true,
        },
        {logger, languageCode},
        ["mainImage"],
        undefined,
        {featuredSortOrder: 1, name: 1},
        FEATURED_LIMIT,
    );

    const projectIds = projects.map((project) => project._id);
    const hierarchy = await loadMarketingCatalogHierarchy(projectIds, companyId);

    const mapped = projects.map((project) => {
        const projectKey = objectIdToString(project._id);
        const edifices = hierarchy.edificesByProject.get(projectKey) ?? [];
        const units = hierarchy.unitsByProject.get(projectKey) ?? [];
        const catalog = mapMarketingProjectCatalogListItem(
            project,
            edifices,
            units,
            hierarchy.floorsByEdifice,
        );
        return {
            _id: catalog._id,
            name: catalog.name,
            slug: catalog.slug,
            location: catalog.location,
            city: catalog.city,
            mainImage: catalog.mainImage,
            propertyTypes: catalog.propertyTypes,
        };
    });

    logger.finish(`Loaded ${mapped.length} featured marketing projects`);
    return {
        projects: mapped,
        total: mapped.length,
    };
}

export const basePath = "/api/realEstate/marketingFeaturedProjects";
module.exports = {router, basePath};
