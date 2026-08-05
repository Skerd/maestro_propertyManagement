import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {decimal128ToNumber} from "@coreModule/utilities/mappers/common.mapper";
import {projectService} from "../../../database/schemas/project/project.service";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {
    marketingStatsFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingStats/marketingStats.form.validator";
import {
    MarketingStatsFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingStats/marketingStats.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";

const router = Router();

type MarketingStatsParams = NotAuthenticatedMWType;

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingStatsFormSchema),
    asyncHandler(marketingStats),
);

function toNumber(value: unknown): number {
    const n = decimal128ToNumber(value);
    return n == null || Number.isNaN(n) ? 0 : n;
}

async function marketingStats(params: MarketingStatsParams): Promise<MarketingStatsFormResponseType> {
    const {origin, languageCode, logger} = params;
    logger.start("Loading marketing platform stats...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const companyId = company._id;
    const opts = {logger, languageCode};

    const [totalProjects, unitsByCurrencyAgg, coOwnersAgg] = await Promise.all([
        projectService.count({company: companyId, deletedAt: null}, opts),
        unitService.aggregate(
            [
                {$match: {company: companyId, deletedAt: null}},
                {
                    $group: {
                        _id: "$priceCurrency",
                        totalValue: {$sum: "$price"},
                        totalUnits: {$sum: 1},
                    },
                },
                {
                    $lookup: {
                        from: "currencies",
                        localField: "_id",
                        foreignField: "_id",
                        as: "currencyInfo",
                    },
                },
                {$unwind: {path: "$currencyInfo", preserveNullAndEmptyArrays: true}},
            ],
            opts,
        ),
        unitService.aggregate(
            [
                {$match: {company: companyId, deletedAt: null}},
                {
                    $lookup: {
                        from: "sales",
                        localField: "_id",
                        foreignField: "unit",
                        pipeline: [
                            {$match: {buyer: {$ne: null}}},
                            {$project: {buyer: 1}},
                        ],
                        as: "sales",
                    },
                },
                {$unwind: "$sales"},
                {$group: {_id: "$sales.buyer"}},
                {$count: "count"},
            ],
            opts,
        ),
    ]);

    let totalUnits = 0;
    let totalValue = 0;
    let dominant: {value: number; symbol?: string; abbreviation?: string} | null = null;

    for (const row of unitsByCurrencyAgg) {
        const units = typeof row.totalUnits === "number" ? row.totalUnits : 0;
        const value = toNumber(row.totalValue);
        totalUnits += units;
        totalValue += value;

        if (!dominant || value > dominant.value) {
            dominant = {
                value,
                symbol: row.currencyInfo?.symbol,
                abbreviation: row.currencyInfo?.abbreviation,
            };
        }
    }

    const totalCoOwners =
        coOwnersAgg.length > 0 && typeof coOwnersAgg[0].count === "number"
            ? coOwnersAgg[0].count
            : 0;

    logger.finish(
        `Marketing stats: ${totalProjects} projects, ${totalUnits} units, value=${totalValue}, coOwners=${totalCoOwners}`,
    );

    return {
        totalProjects,
        totalUnits,
        totalValue,
        valueCurrency: dominant
            ? {symbol: dominant.symbol, abbreviation: dominant.abbreviation}
            : undefined,
        totalCoOwners,
    };
}

export const basePath = "/api/realEstate/marketingStats";
module.exports = {router, basePath};
