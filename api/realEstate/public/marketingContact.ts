import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    marketingContactFormSchema,
    MarketingContactFormType,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingContact/marketingContact.form.validator";
import {
    MarketingContactFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingContact/marketingContact.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {leadService} from "../../../database/schemas/lead/lead.service";
import {LeadInterest, LeadSource, LeadStatus} from "../../../database/schemas/lead/lead";
import {projectService} from "../../../database/schemas/project/project.service";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";

const router = Router();

type MarketingContactParams = NotAuthenticatedMWType & MarketingContactFormType;

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(marketingContactFormSchema),
    asyncHandler(marketingContact),
);

async function resolveLeadInterests(
    companyId: ObjectId,
    projectInterest: string | undefined,
    unitInterest: string | undefined,
    languageCode: string,
    logger: NotAuthenticatedMWType["logger"],
): Promise<{projectInterest?: ObjectId; unitInterest?: ObjectId}> {
    const opts = {logger, languageCode};
    let projectId: ObjectId | undefined;
    let unitId: ObjectId | undefined;

    if (projectInterest) {
        const project = await projectService.findOne(
            {_id: new ObjectId(projectInterest), company: companyId, deletedAt: null},
            opts,
        );
        if (!project) {
            throw apiValidationException("project_not_found", "projectInterest", projectInterest, languageCode);
        }
        projectId = project._id as ObjectId;
    }

    if (unitInterest) {
        const unit = await unitService.findOne(
            {_id: new ObjectId(unitInterest), company: companyId, deletedAt: null},
            opts,
        );
        if (!unit) {
            throw apiValidationException("unit_not_found", "unitInterest", unitInterest, languageCode);
        }
        unitId = unit._id as ObjectId;

        const unitProjectId = (unit.project as any)?._id ?? unit.project;
        if (projectId && unitProjectId && objectIdToString(unitProjectId) !== objectIdToString(projectId)) {
            throw apiValidationException("unit_not_in_project", "unitInterest", unitInterest, languageCode);
        }
        if (!projectId && unitProjectId) {
            projectId = unitProjectId instanceof ObjectId ? unitProjectId : new ObjectId(String(unitProjectId));
        }
    }

    return {
        ...(projectId ? {projectInterest: projectId} : {}),
        ...(unitId ? {unitInterest: unitId} : {}),
    };
}

async function marketingContact(params: MarketingContactParams): Promise<MarketingContactFormResponseType> {
    const {
        origin,
        languageCode,
        logger,
        name,
        surname,
        email,
        phone,
        message,
        interest,
        projectInterest,
        unitInterest,
    } = params;
    logger.start("Creating marketing contact lead...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const opts = {logger, languageCode};
    const interests = await resolveLeadInterests(
        company._id,
        projectInterest,
        unitInterest,
        languageCode,
        logger,
    );

    await leadService.create(
        {
            company: company._id,
            firstName: name.trim(),
            lastName: surname.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            notes: message.trim(),
            ...(interest ? {interest: interest as LeadInterest} : {}),
            ...interests,
            status: LeadStatus.NEW,
            source: LeadSource.WEBSITE,
        },
        opts,
    );

    logger.finish(`Marketing contact lead created for company=${company._id}`);
    return {ok: true};
}

export const basePath = "/api/realEstate/marketingContact";
module.exports = {router, basePath};
