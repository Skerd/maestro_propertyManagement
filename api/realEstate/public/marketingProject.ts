import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {projectService} from "../../../database/schemas/project/project.service";
import {
    marketingProjectSingleFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProject/marketingProjectSingle.form.validator";
import {
    MarketingProjectSingleFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProject/marketingProjectSingle.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {loadMarketingHierarchyForProject} from "../../../utilities/marketing/marketingHierarchy.util";
import {mapMarketingProjectSingle} from "../../../utilities/mappers/marketing/marketing.mapper";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

const router = Router();

type MarketingProjectSingleParams = NotAuthenticatedMWType & {
    projectId: string;
};

router.post(
    "/single",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingProjectSingleFormSchema),
    asyncHandler(marketingProjectSingle),
);

async function marketingProjectSingle(params: MarketingProjectSingleParams): Promise<MarketingProjectSingleFormResponseType> {
    const {origin, languageCode, logger, projectId} = params;
    logger.start(`Loading marketing project [${projectId}]...`);

    const company = await resolveMarketingCompany(origin, languageCode);
    const projectObjectId = new ObjectId(projectId);

    const project = await projectService.findOne(
        {_id: projectObjectId, company: company._id, deletedAt: null},
        {logger, languageCode},
        ["mainImage", "imageGallery", "videoGallery"],
    );

    if (!project) {
        throw apiValidationException("project_not_found", "projectId", projectId, languageCode);
    }

    const hierarchy = await loadMarketingHierarchyForProject(projectObjectId, company._id);
    const projectKey = objectIdToString(project._id);
    const edifices = hierarchy.edificesByProject.get(projectKey) ?? [];

    logger.finish(`Loaded marketing project [${projectId}]`);
    return {
        project: mapMarketingProjectSingle(
            project,
            edifices,
            hierarchy.floorsByEdifice,
            hierarchy.unitsByFloor,
            hierarchy.units,
        ),
    };
}

export const basePath = "/api/realEstate/marketingProject";
module.exports = {router, basePath};
