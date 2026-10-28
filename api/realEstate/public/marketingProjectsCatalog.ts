import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
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
import {CatalogProjectFilterParams} from "../../../utilities/marketing/marketingCatalogFilters.util";
import {loadMarketingProjectsCatalog} from "../../../utilities/marketing/marketingProjectsCatalog.util";

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

    const {projects: filtered, filterOptions} = await loadMarketingProjectsCatalog(company._id, filterParams, {languageCode, logger});

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
