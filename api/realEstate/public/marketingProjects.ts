import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {projectService} from "../../../database/schemas/project/project.service";
import {
    marketingProjectsFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjects/marketingProjects.form.validator";
import {
    MarketingProjectsFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjects/marketingProjects.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {loadMarketingHierarchyForProjects} from "../../../utilities/marketing/marketingHierarchy.util";
import {mapMarketingProjectListItem} from "../../../utilities/mappers/marketing/marketing.mapper";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

const router = Router();

type MarketingProjectsParams = NotAuthenticatedMWType & {
    tab?: "real-estate" | "co-ownership" | "tokenization";
    search?: string;
};

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingProjectsFormSchema),
    asyncHandler(marketingProjects),
);

async function marketingProjects(params: MarketingProjectsParams): Promise<MarketingProjectsFormResponseType> {
    const {origin, languageCode, logger, search} = params;
    logger.start("Loading marketing projects...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const companyId = company._id;

    const projects = await projectService.find(
        {company: companyId, deletedAt: null},
        {logger, languageCode},
        ["mainImage", "imageGallery"],
    );

    const projectIds = projects.map((project) => project._id);
    const hierarchy = await loadMarketingHierarchyForProjects(projectIds, companyId);

    let mapped = projects.map((project) => {
        const projectKey = objectIdToString(project._id);
        return mapMarketingProjectListItem(
            project,
            hierarchy.edificesByProject.get(projectKey) ?? [],
            hierarchy.unitsByProject.get(projectKey) ?? [],
        );
    });

    if (search?.trim()) {
        const query = search.trim().toLowerCase();
        mapped = mapped.filter((project) =>
            project.name.toLowerCase().includes(query) ||
            project.location?.toLowerCase().includes(query),
        );
    }

    logger.finish(`Loaded ${mapped.length} marketing projects`);
    return {
        projects: mapped,
        total: mapped.length,
    };
}

export const basePath = "/api/realEstate/marketingProjects";
module.exports = {router, basePath};
