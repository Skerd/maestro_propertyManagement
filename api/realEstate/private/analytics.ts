/**
 * analytics — Power BI / BI dataset feed (§3.P).
 *
 * POST /api/realEstate/analytics { dataset } returns a flat, read-only fact table
 * for BI tools. Company-scoped via the private auth. Datasets:
 *   - "costByBkp": per-project × BKP estimated (BoqItem) vs invoiced (ContractorInvoice)
 *
 * Note: SAP/Abacus certified export shapes are added to erpExport (CSV/interface
 * layouts); this endpoint is the Power BI dataset half of §3.P.
 */
import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import BoqItem from "../../../database/schemas/boqItem/boqItem";
import ContractorInvoice from "../../../database/schemas/contractorInvoice/contractorInvoice";

export const basePath = "/api/realEstate/analytics";
export const router = Router();

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType & {dataset?: string}) => {
        const {company, dataset} = params;
        const companyId = company._id as ObjectId;
        const ds = dataset || "costByBkp";

        if (ds === "costByBkp") {
            const [est, inv] = await Promise.all([
                BoqItem.aggregate([
                    {$match: {company: companyId, deletedAt: null, status: "active", classificationCode: {$nin: [null, ""]}}},
                    {$group: {_id: {project: "$project", code: "$classificationCode"}, estimated: {$sum: {$toDouble: {$ifNull: ["$plannedAmount", 0]}}}}},
                ]),
                ContractorInvoice.aggregate([
                    {$match: {company: companyId, deletedAt: null, status: {$ne: "rejected"}, bkpAccountCode: {$nin: [null, ""]}}},
                    {$group: {_id: {project: "$project", code: "$bkpAccountCode"}, invoiced: {$sum: {$toDouble: {$ifNull: ["$grossAmount", 0]}}}}},
                ]),
            ]);
            const rows = new Map<string, any>();
            for (const e of est) {
                const key = `${String(e._id.project)}|${e._id.code}`;
                rows.set(key, {projectId: String(e._id.project), bkpCode: String(e._id.code), estimated: e.estimated, invoiced: 0});
            }
            for (const i of inv) {
                const key = `${String(i._id.project)}|${i._id.code}`;
                const r = rows.get(key) ?? {projectId: String(i._id.project), bkpCode: String(i._id.code), estimated: 0, invoiced: 0};
                r.invoiced = i.invoiced;
                rows.set(key, r);
            }
            return {dataset: ds, rows: [...rows.values()], computedAt: new Date().toISOString()};
        }

        return {dataset: ds, rows: [], computedAt: new Date().toISOString()};
    }),
);
