/**
 * Group / multi-branch dashboard
 *
 * If the authenticated company has child companies (branches), this endpoint
 * returns aggregated real estate KPIs for each branch plus a group total.
 * If the company has no children but has a parentCompany, it fetches the
 * parent's children so HQ and branch users both see the full group view.
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import Company from "@coreModule/database/schemas/company/company";
import Unit, {UnitStatus} from "../../../database/schemas/unit/unit";
import Sale from "../../../database/schemas/sale/sale";
import Commission, {CommissionStatus} from "../../../database/schemas/commission/commission";
import Lease, {LeaseStatus} from "../../../database/schemas/lease/lease";
import Snag from "../../../database/schemas/snag/snag";
import type {GroupDashboardResponse, BranchKpi} from "armonia/src/modules/propertyManagement/api/realEstate/private/groupDashboard/groupDashboard.response.type";

export const basePath = "/api/realEstate/groupDashboard";
export const router = Router();

function toNumber(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "object" && v !== null && "toString" in v) {
        return parseFloat(String((v as {toString(): string}).toString())) || 0;
    }
    return parseFloat(String(v)) || 0;
}

function byCompany<T extends {_id: unknown}>(arr: T[]): Map<string, T> {
    return new Map(arr.map(r => [String(r._id), r]));
}

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 20}),
    asyncHandler(async (params: AuthenticatedMWType): Promise<GroupDashboardResponse> => {
        const {company} = params;
        const companyId = company._id as ObjectId;

        let branches = await Company.find({parentCompany: companyId, deletedAt: null})
            .select("_id name")
            .lean();

        let rootId = companyId;
        let rootName = (company.name as string) ?? "";
        let isHq = branches.length > 0;

        if (!isHq && company.parentCompany) {
            const parentId = typeof company.parentCompany === "object"
                ? company.parentCompany._id as ObjectId
                : company.parentCompany as ObjectId;
            const parent = await Company.findById(parentId).select("name").lean();
            rootName = parent?.name ?? "";
            rootId = parentId;
            branches = await Company.find({parentCompany: parentId, deletedAt: null})
                .select("_id name")
                .lean();
        }

        const branchIds: ObjectId[] = [
            rootId,
            ...(branches as Array<{_id: ObjectId}>).map(b => b._id),
        ];

        const companyNames: Record<string, string> = {[rootId.toString()]: rootName};
        for (const b of branches as Array<{_id: ObjectId; name: string}>) {
            companyNames[b._id.toString()] = b.name;
        }

        const [unitAgg, saleAgg, commAgg, leaseAgg, snagAgg] = await Promise.all([
            Unit.aggregate([
                {$match: {company: {$in: branchIds}, deletedAt: null}},
                {$group: {
                    _id: "$company",
                    total: {$sum: 1},
                    available: {$sum: {$cond: [{$eq: ["$status", UnitStatus.AVAILABLE]}, 1, 0]}},
                    sold: {$sum: {$cond: [{$eq: ["$status", UnitStatus.SOLD]}, 1, 0]}},
                    rented: {$sum: {$cond: [{$eq: ["$status", UnitStatus.RENTED]}, 1, 0]}},
                }},
            ]),
            Sale.aggregate([
                {$match: {company: {$in: branchIds}, deletedAt: null}},
                {$group: {
                    _id: "$company",
                    revenue: {$sum: {$toDouble: {$ifNull: ["$finalPrice", 0]}}},
                }},
            ]),
            Commission.aggregate([
                {$match: {
                    company: {$in: branchIds},
                    deletedAt: null,
                    status: {$ne: CommissionStatus.VOIDED},
                }},
                {$group: {
                    _id: "$company",
                    amount: {$sum: {$toDouble: {$ifNull: ["$amount", 0]}}},
                }},
            ]),
            Lease.aggregate([
                {$match: {
                    company: {$in: branchIds},
                    deletedAt: null,
                    status: LeaseStatus.ACTIVE,
                }},
                {$group: {_id: "$company", count: {$sum: 1}}},
            ]),
            Snag.aggregate([
                {$match: {
                    company: {$in: branchIds},
                    deletedAt: null,
                    status: {$in: ["open", "in_progress"]},
                }},
                {$group: {_id: "$company", count: {$sum: 1}}},
            ]),
        ]);

        const unitMap = byCompany(unitAgg as Array<{_id: ObjectId; total?: number; available?: number; sold?: number; rented?: number}>);
        const saleMap = byCompany(saleAgg as Array<{_id: ObjectId; revenue?: number}>);
        const commMap = byCompany(commAgg as Array<{_id: ObjectId; amount?: number}>);
        const leaseMap = byCompany(leaseAgg as Array<{_id: ObjectId; count?: number}>);
        const snagMap = byCompany(snagAgg as Array<{_id: ObjectId; count?: number}>);

        const branchKpis: BranchKpi[] = branchIds.map(cid => {
            const sid = cid.toString();
            const u = unitMap.get(sid);
            const s = saleMap.get(sid);
            const c = commMap.get(sid);
            const l = leaseMap.get(sid);
            const sn = snagMap.get(sid);
            return {
                companyId: sid,
                companyName: companyNames[sid] ?? sid,
                totalUnits: u?.total ?? 0,
                availableUnits: u?.available ?? 0,
                soldUnits: u?.sold ?? 0,
                rentedUnits: u?.rented ?? 0,
                totalRevenue: toNumber(s?.revenue),
                totalCommissions: toNumber(c?.amount),
                activeLeases: l?.count ?? 0,
                openSnags: sn?.count ?? 0,
            };
        });

        const totals: Omit<BranchKpi, "companyId" | "companyName"> = {
            totalUnits: branchKpis.reduce((s, b) => s + b.totalUnits, 0),
            availableUnits: branchKpis.reduce((s, b) => s + b.availableUnits, 0),
            soldUnits: branchKpis.reduce((s, b) => s + b.soldUnits, 0),
            rentedUnits: branchKpis.reduce((s, b) => s + b.rentedUnits, 0),
            totalRevenue: branchKpis.reduce((s, b) => s + b.totalRevenue, 0),
            totalCommissions: branchKpis.reduce((s, b) => s + b.totalCommissions, 0),
            activeLeases: branchKpis.reduce((s, b) => s + b.activeLeases, 0),
            openSnags: branchKpis.reduce((s, b) => s + b.openSnags, 0),
        };

        const response: GroupDashboardResponse = {
            groupName: rootName || undefined,
            isHeadquarters: isHq,
            branches: branchKpis,
            totals,
            computedAt: new Date().toISOString(),
        };

        return response;
    }),
);
