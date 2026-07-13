import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {projectService} from "../../../database/schemas/project/project.service";
import {
    marketingProjectsCatalogFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.validator";
import {
    MarketingProjectsCatalogFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.response.type";
import type {
    MarketingBedroomFilter,
    MarketingPropertyTypeId,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.shared.types";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {loadMarketingCatalogHierarchy} from "../../../utilities/marketing/marketingCatalogHierarchy.util";
import {
    applyCatalogProjectFilters,
    buildCatalogFilterOptions,
    CatalogProjectFilterParams,
} from "../../../utilities/marketing/marketingCatalogFilters.util";
import {mapMarketingProjectCatalogListItem} from "../../../utilities/mappers/marketing/marketingCatalog.mapper";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

const router = Router();

type MarketingProjectsCatalogParams = NotAuthenticatedMWType & CatalogProjectFilterParams;

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingProjectsCatalogFormSchema),
    asyncHandler(marketingProjectsCatalog),
);

async function marketingProjectsCatalog(
    params: MarketingProjectsCatalogParams,
): Promise<MarketingProjectsCatalogFormResponseType> {
    const {origin, languageCode, logger} = params;
    logger.start("Loading marketing projects catalog...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const companyId = company._id;

    const projects = await projectService.find(
        {company: companyId, deletedAt: null},
        {logger, languageCode},
        ["mainImage", "imageGallery"],
    );

    const projectIds = projects.map((project) => project._id);
    const hierarchy = await loadMarketingCatalogHierarchy(projectIds, companyId);

    const unitsByProjectString = new Map<string, typeof hierarchy.units>();
    for (const [projectKey, units] of hierarchy.unitsByProject.entries()) {
        unitsByProjectString.set(projectKey, units);
    }

    const mapped = projects.map((project) => {
        const projectKey = objectIdToString(project._id);
        const edifices = hierarchy.edificesByProject.get(projectKey) ?? [];
        const units = hierarchy.unitsByProject.get(projectKey) ?? [];
        return mapMarketingProjectCatalogListItem(project, edifices, units, hierarchy.floorsByEdifice);
    });

    const filterOptions = buildCatalogFilterOptions(mapped);

    const filterParams: CatalogProjectFilterParams = {
        search: params.search,
        tab: params.tab,
        projectId: params.projectId,
        city: params.city && params.city !== "any" ? params.city : undefined,
        propertyType: params.propertyType as MarketingPropertyTypeId | undefined,
        bedrooms: params.bedrooms as MarketingBedroomFilter | undefined,
        areaSqmMin: params.areaSqmMin,
        priceMin: params.priceMin,
        priceMax: params.priceMax,
    };

    const filtered = applyCatalogProjectFilters(mapped, unitsByProjectString, filterParams);

    logger.finish(`Loaded ${filtered.length} marketing catalog projects`);
    return {
        projects: filtered,
        total: filtered.length,
        filterOptions,
    };
}

export const basePath = "/api/realEstate/marketingProjectsCatalog";
export {router};
module.exports = {router, basePath};
