import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {projectService} from "../../../database/schemas/project/project.service";
import {
    marketingProjectCatalogSingleFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectCatalog/marketingProjectCatalogSingle.form.validator";
import {
    MarketingProjectCatalogSingleFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectCatalog/marketingProjectCatalogSingle.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {loadMarketingCatalogHierarchyForProject} from "../../../utilities/marketing/marketingCatalogHierarchy.util";
import {loadMarketingCatalogPolygonData} from "../../../utilities/marketing/marketingCatalogPolygon.util";
import {mapMarketingProjectCatalogSingle} from "../../../utilities/mappers/marketing/marketingCatalog.mapper";

const router = Router();

type MarketingProjectCatalogParams = NotAuthenticatedMWType & {
    projectId: string;
};

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingProjectCatalogSingleFormSchema),
    asyncHandler(marketingProjectCatalogSingle),
);

async function marketingProjectCatalogSingle(
    params: MarketingProjectCatalogParams,
): Promise<MarketingProjectCatalogSingleFormResponseType> {
    const {origin, languageCode, logger, projectId} = params;
    logger.start("Loading marketing project catalog single...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const companyId = company._id;
    const projectObjectId = new ObjectId(projectId);

    const project = await projectService.findOne(
        {_id: projectObjectId, company: companyId, deletedAt: null},
        {logger, languageCode},
        ["mainImage", "imageGallery", "videoGallery"],
    );

    if (!project) {
        throw apiValidationException("project_not_found", "projectId", projectId, languageCode);
    }

    const hierarchy = await loadMarketingCatalogHierarchyForProject(projectObjectId, companyId);

    const edificeIds = hierarchy.edifices.map((edifice) => edifice._id);
    const floorIds = hierarchy.floors.map((floor) => floor._id);
    const polygonData = await loadMarketingCatalogPolygonData(
        [projectObjectId],
        edificeIds,
        floorIds,
        companyId,
        languageCode,
    );

    const mapped = mapMarketingProjectCatalogSingle(
        project,
        hierarchy.edifices,
        hierarchy.floorsByEdifice,
        hierarchy.unitsByFloor,
        hierarchy.units,
        polygonData,
    );

    logger.finish(`Loaded marketing catalog project ${projectId}`);
    return {project: mapped};
}

export const basePath = "/api/realEstate/marketingProjectCatalog/single";
export {router};
module.exports = {router, basePath};
