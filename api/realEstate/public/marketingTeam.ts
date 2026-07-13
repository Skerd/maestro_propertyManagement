import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {userService} from "@coreModule/database/schemas/user/user.service";
import {
    marketingTeamFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingTeam/marketingTeam.form.validator";
import {
    MarketingTeamFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingTeam/marketingTeam.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {mapMarketingTeamMember} from "../../../utilities/mappers/marketing/marketing.mapper";

const router = Router();

type MarketingTeamParams = NotAuthenticatedMWType;

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingTeamFormSchema),
    asyncHandler(marketingTeam),
);

async function marketingTeam(params: MarketingTeamParams): Promise<MarketingTeamFormResponseType> {
    const {origin, languageCode, logger} = params;
    logger.start("Loading marketing team...");

    const company = await resolveMarketingCompany(origin, languageCode);

    const users = await userService.find(
        {
            companies: company._id,
            isActive: true,
            deletedAt: null,
        },
        {logger, languageCode},
        ["photo", "roles.role"],
    );

    const members = users
        .filter((user) => user.photo)
        .slice(0, 12)
        .map(mapMarketingTeamMember);

    logger.finish(`Loaded ${members.length} marketing team members`);
    return {members};
}

export const basePath = "/api/realEstate/marketingTeam";
module.exports = {router, basePath};
