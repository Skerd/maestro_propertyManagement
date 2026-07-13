import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {projectService} from "../../../database/schemas/project/project.service";
import {inspectionService} from "../../../database/schemas/inspection/inspection.service";
import {UnitStatus} from "../../../database/schemas/unit/unit";
import {
    marketingAvailabilityFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingAvailability/marketingAvailability.form.validator";
import {
    MarketingAvailabilityFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingAvailability/marketingAvailability.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {loadMarketingHierarchyForProject} from "../../../utilities/marketing/marketingHierarchy.util";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

const router = Router();

type MarketingAvailabilityParams = NotAuthenticatedMWType & {
    projectId: string;
    month: string;
};

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingAvailabilityFormSchema),
    asyncHandler(marketingAvailability),
);

function parseMonth(month: string): {year: number; monthIndex: number; daysInMonth: number} {
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!year || monthIndex < 0 || monthIndex > 11) {
        throw new Error("Invalid month");
    }
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return {year, monthIndex, daysInMonth};
}

async function marketingAvailability(params: MarketingAvailabilityParams): Promise<MarketingAvailabilityFormResponseType> {
    const {origin, languageCode, logger, projectId, month} = params;
    logger.start(`Loading marketing availability for project [${projectId}] month [${month}]...`);

    const company = await resolveMarketingCompany(origin, languageCode);
    const projectObjectId = new ObjectId(projectId);

    const project = await projectService.findOne(
        {_id: projectObjectId, company: company._id, deletedAt: null},
        {logger, languageCode},
    );

    if (!project) {
        throw apiValidationException("project_not_found", "projectId", projectId, languageCode);
    }

    const hierarchy = await loadMarketingHierarchyForProject(projectObjectId, company._id);
    const availableUnits = hierarchy.units.filter((unit) => unit.status === UnitStatus.AVAILABLE);
    const totalSlots = availableUnits.length;
    const unitIds = availableUnits.map((unit) => unit._id);

    const {year, monthIndex, daysInMonth} = parseMonth(month);
    const rangeStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(year, monthIndex, daysInMonth, 23, 59, 59));

    const inspections = unitIds.length > 0
        ? await inspectionService.find({
            unit: {$in: unitIds},
            scheduledDate: {$gte: rangeStart, $lte: rangeEnd},
            deletedAt: null,
        })
        : [];

    const bookedByDate = new Map<string, Set<string>>();
    for (const inspection of inspections) {
        const scheduled = inspection.scheduledDate || inspection.inspectionDate;
        if (!scheduled) {
            continue;
        }
        const dateKey = scheduled.toISOString().slice(0, 10);
        const unitId = objectIdToString((inspection.unit as any)?._id ?? inspection.unit);
        const bucket = bookedByDate.get(dateKey) ?? new Set<string>();
        bucket.add(unitId);
        bookedByDate.set(dateKey, bucket);
    }

    const days = Array.from({length: daysInMonth}, (_, index) => {
        const day = index + 1;
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const bookedCount = bookedByDate.get(dateKey)?.size ?? 0;
        const availableSlots = Math.max(totalSlots - bookedCount, 0);
        return {
            date: dateKey,
            availableSlots,
            totalSlots,
        };
    });

    logger.finish(`Loaded marketing availability for project [${projectId}]`);
    return {days};
}

export const basePath = "/api/realEstate/marketingAvailability";
module.exports = {router, basePath};
