import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {projectService} from "../../../database/schemas/project/project.service";
import {floorService} from "../../../database/schemas/floor/floor.service";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {
    marketingUnitSingleFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingUnit/marketingUnitSingle.form.validator";
import {
    MarketingUnitSingleFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingUnit/marketingUnitSingle.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {
    loadMarketingHierarchyForProject,
    resolveUnitFloorContext,
} from "../../../utilities/marketing/marketingHierarchy.util";
import {mapMarketingUnitSingle} from "../../../utilities/mappers/marketing/marketing.mapper";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

const router = Router();

type MarketingUnitSingleParams = NotAuthenticatedMWType & {
    projectId: string;
    unitId: string;
};

router.post(
    "/single",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingUnitSingleFormSchema),
    asyncHandler(marketingUnitSingle),
);

async function resolveFallbackUnitFloorContext(
    unit: {_id: ObjectId; floor?: any},
    companyId: ObjectId,
    logger: NotAuthenticatedMWType["logger"],
    languageCode: string,
) {
    const floorRef = unit.floor;
    const floorId = floorRef?._id ?? floorRef;
    if (!floorId) {
        return {};
    }

    const floorObjectId = floorId instanceof ObjectId ? floorId : new ObjectId(String(floorId));
    const floor = typeof floorRef === "object" && floorRef?.name
        ? floorRef
        : await floorService.findOne(
            {_id: floorObjectId, company: companyId, deletedAt: null},
            {logger, languageCode},
        );

    if (!floor) {
        return {};
    }

    const edificeId = (floor.edifice as any)?._id ?? floor.edifice;
    if (!edificeId) {
        return {floor};
    }

    const edificeFloors = await floorService.find(
        {edifice: edificeId, company: companyId, deletedAt: null},
        {logger, languageCode},
    );

    return {
        floor,
        totalFloorsInEdifice: edificeFloors.length,
    };
}

async function marketingUnitSingle(params: MarketingUnitSingleParams): Promise<MarketingUnitSingleFormResponseType> {
    const {origin, languageCode, logger, projectId, unitId} = params;
    logger.start(`Loading marketing unit [${unitId}]...`);

    const company = await resolveMarketingCompany(origin, languageCode);
    const projectObjectId = new ObjectId(projectId);
    const unitObjectId = new ObjectId(unitId);

    const project = await projectService.findOne(
        {_id: projectObjectId, company: company._id, deletedAt: null},
        {logger, languageCode},
    );

    if (!project) {
        throw apiValidationException("project_not_found", "projectId", projectId, languageCode);
    }

    const hierarchy = await loadMarketingHierarchyForProject(projectObjectId, company._id);
    const unit = hierarchy.units.find((item) => objectIdToString(item._id) === unitId);

    if (!unit) {
        const fallbackUnit = await unitService.findOne(
            {_id: unitObjectId, company: company._id, deletedAt: null},
            {logger, languageCode},
            ["mainImage", "imageGallery", "unitType", "priceCurrency", "floor"],
        );
        if (!fallbackUnit) {
            throw apiValidationException("unit_not_found", "unitId", unitId, languageCode);
        }

        const floorContext = await resolveFallbackUnitFloorContext(
            fallbackUnit,
            company._id,
            logger,
            languageCode,
        );

        logger.finish(`Loaded marketing unit [${unitId}]`);
        return {unit: mapMarketingUnitSingle(fallbackUnit, projectId, floorContext)};
    }

    const floorContext = resolveUnitFloorContext(unitId, hierarchy);

    logger.finish(`Loaded marketing unit [${unitId}]`);
    return {unit: mapMarketingUnitSingle(unit, projectId, floorContext)};
}

export const basePath = "/api/realEstate/marketingUnit";
module.exports = {router, basePath};
