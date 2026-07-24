/**
 * estimateComparison — Kostenermittlung eBKP-H read-model.
 *
 * Groups BoqItem lines by classificationCode within a cost standard and compares
 * the same element across projects/edifices/budgets (planned qty/amount, actuals),
 * with min/max/avg/total per code. This is the analog-comparison core value of
 * eBKP-H cost determination (§3.A).
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import BoqItem from "../../../database/schemas/boqItem/boqItem";
import Project from "../../../database/schemas/project/project";
import Budget from "../../../database/schemas/budget/budget";
import Edifice from "../../../database/schemas/edifice/edifice";
import CostClassification from "../../../database/schemas/costClassification/costClassification";
import type {
    EstimateComparisonEntry,
    EstimateComparisonRow,
    EstimateComparisonResponse,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/estimateComparison/estimateComparison.response.type";

export const basePath = "/api/realEstate/estimateComparison";
export const router = Router();

const DEFAULT_STANDARD = "ebkp_h";

function idStr(v: unknown): string {
    return v == null ? "" : String(v);
}

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 20}),
    asyncHandler(async (params: AuthenticatedMWType & {standard?: string; code?: string}): Promise<EstimateComparisonResponse> => {
        const {company, standard: standardParam, code: codeParam} = params;
        const companyId = company._id as ObjectId;

        const standard = (standardParam && String(standardParam)) || DEFAULT_STANDARD;
        const codeFilter = codeParam ? String(codeParam) : undefined;

        const match: Record<string, any> = {
            company: companyId,
            deletedAt: null,
            status: "active",
            classificationStandard: standard,
            classificationCode: {$nin: [null, ""]},
        };
        if (codeFilter) match.classificationCode = codeFilter;

        const grouped = await BoqItem.aggregate([
            {$match: match},
            {
                $group: {
                    _id: {
                        code: "$classificationCode",
                        project: "$project",
                        budget: "$budget",
                        edifice: "$edifice",
                    },
                    plannedQty: {$sum: {$toDouble: {$ifNull: ["$plannedQty", 0]}}},
                    plannedAmount: {$sum: {$toDouble: {$ifNull: ["$plannedAmount", 0]}}},
                    actualAmount: {$sum: {$toDouble: {$ifNull: ["$actualAmount", 0]}}},
                },
            },
        ]);

        const projectIds = new Set<string>();
        const budgetIds = new Set<string>();
        const edificeIds = new Set<string>();
        const codes = new Set<string>();
        for (const g of grouped) {
            if (g._id.project) projectIds.add(idStr(g._id.project));
            if (g._id.budget) budgetIds.add(idStr(g._id.budget));
            if (g._id.edifice) edificeIds.add(idStr(g._id.edifice));
            if (g._id.code) codes.add(String(g._id.code));
        }

        const [projects, budgets, edifices, classifications] = await Promise.all([
            Project.find({_id: {$in: [...projectIds].map(id => new ObjectId(id))}}).select("name").lean(),
            Budget.find({_id: {$in: [...budgetIds].map(id => new ObjectId(id))}}).select("name title").lean(),
            Edifice.find({_id: {$in: [...edificeIds].map(id => new ObjectId(id))}}).select("name").lean(),
            CostClassification.find({company: companyId, standard, code: {$in: [...codes]}})
                .select("code title unitOfMeasure").lean(),
        ]);

        const projectName = new Map(projects.map((p: any) => [idStr(p._id), p.name as string]));
        const budgetInfo = new Map(budgets.map((b: any) => [idStr(b._id), {name: b.name as string, title: b.title as string}]));
        const edificeName = new Map(edifices.map((e: any) => [idStr(e._id), e.name as string]));
        const codeInfo = new Map(classifications.map((c: any) => [String(c.code), {title: c.title as string, unitOfMeasure: c.unitOfMeasure as string}]));

        const rowMap = new Map<string, EstimateComparisonRow>();
        for (const g of grouped) {
            const code = String(g._id.code);
            const bInfo = budgetInfo.get(idStr(g._id.budget));
            const entry: EstimateComparisonEntry = {
                projectId: idStr(g._id.project),
                projectName: projectName.get(idStr(g._id.project)) ?? "",
                budgetId: idStr(g._id.budget),
                budgetName: bInfo?.name,
                budgetTitle: bInfo?.title,
                edificeId: g._id.edifice ? idStr(g._id.edifice) : undefined,
                edificeName: g._id.edifice ? edificeName.get(idStr(g._id.edifice)) : undefined,
                plannedQty: g.plannedQty ?? 0,
                plannedAmount: g.plannedAmount ?? 0,
                actualAmount: g.actualAmount ?? 0,
            };
            let row = rowMap.get(code);
            if (!row) {
                const ci = codeInfo.get(code);
                row = {
                    classificationStandard: standard,
                    code,
                    title: ci?.title,
                    unitOfMeasure: ci?.unitOfMeasure,
                    occurrences: 0,
                    plannedAmountTotal: 0,
                    plannedAmountMin: 0,
                    plannedAmountMax: 0,
                    plannedAmountAvg: 0,
                    entries: [],
                };
                rowMap.set(code, row);
            }
            row.entries.push(entry);
        }

        const rows = [...rowMap.values()];
        for (const row of rows) {
            const amounts = row.entries.map(e => e.plannedAmount);
            row.occurrences = amounts.length;
            row.plannedAmountTotal = amounts.reduce((s, a) => s + a, 0);
            row.plannedAmountMin = amounts.length ? Math.min(...amounts) : 0;
            row.plannedAmountMax = amounts.length ? Math.max(...amounts) : 0;
            row.plannedAmountAvg = amounts.length ? row.plannedAmountTotal / amounts.length : 0;
            row.entries.sort((a, b) => b.plannedAmount - a.plannedAmount);
        }
        rows.sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}));

        return {
            standard,
            rowCount: rows.length,
            rows,
            computedAt: new Date().toISOString(),
        };
    }),
);
