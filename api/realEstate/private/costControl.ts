/**
 * costControl — Baukostenkontrolle read-model (§3.I).
 *
 * POST /api/realEstate/costControl { projectId, groupBy? } builds a cost-control
 * ledger for a project over the BKP account plan: per-BKP estimated (BoqItem) vs
 * invoiced/paid (ContractorInvoice), plus project totals for committed
 * (CostCommitment) and certified (ProgressClaim). variance = estimated − invoiced.
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Project from "../../../database/schemas/project/project";
import BoqItem from "../../../database/schemas/boqItem/boqItem";
import ContractorInvoice from "../../../database/schemas/contractorInvoice/contractorInvoice";
import CostCommitment from "../../../database/schemas/costCommitment/costCommitment";
import ProgressClaim from "../../../database/schemas/progressClaim/progressClaim";
import CostClassification from "../../../database/schemas/costClassification/costClassification";
import type {CostControlResponse, CostControlRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/costControl/costControl.response.type";

export const basePath = "/api/realEstate/costControl";
export const router = Router();

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType & {projectId?: string; groupBy?: string}): Promise<CostControlResponse> => {
        const {company, languageCode, projectId, groupBy} = params;
        if (!projectId || !ObjectId.isValid(projectId)) {
            throw apiValidationException("projectId_required", "", null, languageCode);
        }
        const companyId = company._id as ObjectId;
        const projectOid = new ObjectId(projectId);
        const project = await Project.findOne({_id: projectOid, company: companyId, deletedAt: null}).select("name").lean();
        if (!project) throw apiValidationException("project_not_found", "", null, languageCode);

        const [estimatedAgg, invoicedAgg, paidAgg, committedAgg, certifiedAgg] = await Promise.all([
            // Estimated: BoqItem plannedAmount grouped by classificationCode.
            BoqItem.aggregate([
                {$match: {project: projectOid, company: companyId, deletedAt: null, status: "active", classificationCode: {$nin: [null, ""]}}},
                {$group: {_id: "$classificationCode", v: {$sum: {$toDouble: {$ifNull: ["$plannedAmount", 0]}}}}},
            ]),
            // Invoiced: ContractorInvoice gross grouped by bkpAccountCode (exclude rejected).
            ContractorInvoice.aggregate([
                {$match: {project: projectOid, company: companyId, deletedAt: null, status: {$ne: "rejected"}, bkpAccountCode: {$nin: [null, ""]}}},
                {$group: {_id: "$bkpAccountCode", v: {$sum: {$toDouble: {$ifNull: ["$grossAmount", 0]}}}}},
            ]),
            ContractorInvoice.aggregate([
                {$match: {project: projectOid, company: companyId, deletedAt: null, status: "paid", bkpAccountCode: {$nin: [null, ""]}}},
                {$group: {_id: "$bkpAccountCode", v: {$sum: {$toDouble: {$ifNull: ["$grossAmount", 0]}}}}},
            ]),
            CostCommitment.aggregate([
                {$match: {project: projectOid, company: companyId, deletedAt: null}},
                {$group: {_id: null, v: {$sum: {$toDouble: {$ifNull: ["$committedAmount", 0]}}}}},
            ]),
            ProgressClaim.aggregate([
                {$match: {project: projectOid, company: companyId, deletedAt: null}},
                {$group: {_id: null, v: {$sum: {$toDouble: {$ifNull: ["$certifiedAmount", 0]}}}}},
            ]),
        ]);

        const estByCode = new Map<string, number>(estimatedAgg.map((r: any) => [String(r._id), r.v]));
        const invByCode = new Map<string, number>(invoicedAgg.map((r: any) => [String(r._id), r.v]));
        const paidByCode = new Map<string, number>(paidAgg.map((r: any) => [String(r._id), r.v]));

        const codes = new Set<string>([...estByCode.keys(), ...invByCode.keys(), ...paidByCode.keys()]);
        const titles = new Map<string, string>();
        if (codes.size) {
            const ccs = await CostClassification.find({company: companyId, code: {$in: [...codes]}, deletedAt: null}).select("code title").lean();
            for (const c of ccs as any[]) titles.set(String(c.code), c.title);
        }

        const rows: CostControlRow[] = [...codes].map((code) => {
            const estimated = estByCode.get(code) ?? 0;
            const invoiced = invByCode.get(code) ?? 0;
            const paid = paidByCode.get(code) ?? 0;
            return {bkpCode: code, title: titles.get(code), estimated, invoiced, paid, variance: estimated - invoiced};
        });
        rows.sort((a, b) => a.bkpCode.localeCompare(b.bkpCode, undefined, {numeric: true}));

        const totalEstimated = rows.reduce((s, r) => s + r.estimated, 0);
        const totalInvoiced = rows.reduce((s, r) => s + r.invoiced, 0);
        const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
        const committed = committedAgg[0]?.v ?? 0;
        const certified = certifiedAgg[0]?.v ?? 0;

        return {
            projectId: String(project._id),
            projectName: project.name,
            groupBy: groupBy || "bkp",
            rows,
            totals: {
                estimated: totalEstimated,
                committed,
                invoiced: totalInvoiced,
                certified,
                paid: totalPaid,
                variance: totalEstimated - totalInvoiced,
            },
            computedAt: new Date().toISOString(),
        };
    }),
);
