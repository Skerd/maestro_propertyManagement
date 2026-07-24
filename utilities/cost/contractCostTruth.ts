import {ObjectId} from "mongodb";
import {Decimal128} from "mongodb";
import Decimal from "decimal.js";
import {constructionContractService} from "../../database/schemas/constructionContract/constructionContract.service";
import {progressClaimService} from "../../database/schemas/progressClaim/progressClaim.service";
import {variationOrderService} from "../../database/schemas/variationOrder/variationOrder.service";

type Ctx = {
    session?: any;
    logger: any;
    languageCode: string;
    actionUserCtx?: {userId?: any};
    company: {_id: ObjectId};
};

function toDecimal(value: unknown): Decimal {
    if (value === undefined || value === null) return new Decimal(0);
    return new Decimal(String(value));
}

/** Sum of costImpact across approved VariationOrders on a contract. */
export async function sumApprovedVariationCostImpact(contractId: ObjectId, ctx: Ctx): Promise<Decimal> {
    const {session, logger, languageCode, company} = ctx;
    const approved = await variationOrderService.find(
        {constructionContract: contractId, company: company._id, status: "approved", deletedAt: null},
        {session, logger, languageCode},
        undefined,
        "costImpact",
    );
    return (approved ?? []).reduce((acc: Decimal, vo: any) => acc.plus(toDecimal(vo.costImpact)), new Decimal(0));
}

/** Sum of certified value (certifiedAmount, falling back to amount) across certified/paid claims on a contract. */
export async function sumCertifiedClaims(contractId: ObjectId, ctx: Ctx, excludeClaimId?: ObjectId): Promise<Decimal> {
    const {session, logger, languageCode, company} = ctx;
    const query: Record<string, any> = {
        constructionContract: contractId,
        company: company._id,
        status: {$in: ["certified", "paid"]},
        deletedAt: null,
    };
    if (excludeClaimId) query._id = {$ne: excludeClaimId};
    const claims = await progressClaimService.find(
        query,
        {session, logger, languageCode},
        undefined,
        "amount certifiedAmount",
    );
    return (claims ?? []).reduce(
        (acc: Decimal, claim: any) => acc.plus(toDecimal(claim.certifiedAmount ?? claim.amount)),
        new Decimal(0),
    );
}

/**
 * Recompute and persist approvedVariationsTotal / certifiedClaimsTotal on a
 * ConstructionContract so budget vs committed vs certified dashboards read
 * stored truth instead of trusting operators to remember.
 */
export async function recomputeContractCostTruth(contractId: ObjectId, ctx: Ctx): Promise<void> {
    const {session, logger, languageCode, actionUserCtx} = ctx;
    const [variationsTotal, claimsTotal] = await Promise.all([
        sumApprovedVariationCostImpact(contractId, ctx),
        sumCertifiedClaims(contractId, ctx),
    ]);
    await constructionContractService.updateByIdOrThrow(
        contractId,
        {
            $set: {
                approvedVariationsTotal: Decimal128.fromString(variationsTotal.toString()),
                certifiedClaimsTotal: Decimal128.fromString(claimsTotal.toString()),
            },
        },
        {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
    );
}
