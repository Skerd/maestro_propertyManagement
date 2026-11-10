/**
 * Group / multi-branch dashboard
 *
 * If the authenticated company has child companies (branches), this endpoint
 * returns aggregated real estate KPIs for each branch plus a group total.
 * If the company has no children but has a parentCompany, it fetches the
 * parent's children so HQ and branch users both see the full group view.
 *
 * Each company's figures are read as that company (DB-02: `withTenant`, one company's slice of a cross-company read),
 * and only where the caller may read them: in another company of the group, an active, unlocked membership whose
 * role there grants the read (as propertyDevelopment's group dashboard does). Other branches are left out.
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {UnitStatus} from "../../../database/schemas/unit/unit";
import {CommissionStatus} from "../../../database/schemas/commission/commission";
import {LeaseStatus} from "../../../database/schemas/lease/lease";
import type {GroupDashboardResponse, BranchKpi} from "armonia/src/modules/propertyManagement/api/realEstate/private/groupDashboard/groupDashboard.response.type";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
} from "@propertyManagement/utilities/security/canReadCollectedFields";

import {unitService} from "../../../database/schemas/unit/unit.service";
import {saleService} from "../../../database/schemas/sale/sale.service";
import {commissionService} from "../../../database/schemas/commission/commission.service";
import {leaseService} from "../../../database/schemas/lease/lease.service";
import {companyService} from "@coreModule/database/schemas/company/company.service";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {userService} from "@coreModule/database/schemas/user/user.service";
import type {UserContext} from "@coreModule/utilities/types/types";
export const basePath = "/api/realEstate/groupDashboard";
export const router = Router();

const GROUP_COLLECTIONS = ["units", "sales", "commissions", "leases"] as const;

function toNumber(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "object" && v !== null && "toString" in v) {
        return parseFloat(String((v as {toString(): string}).toString())) || 0;
    }
    return parseFloat(String(v)) || 0;
}


router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 20}),
    asyncHandler(async (params: AuthenticatedMWType): Promise<GroupDashboardResponse> => {
        const {company, actionUserCtx, languageCode, logger} = params;
        assertAnyCollectedRead(
            GROUP_COLLECTIONS.some((collection) => canReadCollectedFields(collection, actionUserCtx, languageCode)),
            languageCode,
        );
        const companyId = company._id as ObjectId;

        let branches = await companyService.find({parentCompany: companyId}, {withDeleted: false}, undefined, "_id name");

        let rootId = companyId;
        let rootName = (company.name as string) ?? "";
        let isHq = branches.length > 0;

        if (!isHq && company.parentCompany) {
            const parentId = typeof company.parentCompany === "object"
                ? company.parentCompany._id as ObjectId
                : company.parentCompany as ObjectId;
            const parent = await companyService.findById(parentId, {}, undefined, "name");
            rootName = parent?.name ?? "";
            rootId = parentId;
            branches = await companyService.find({parentCompany: parentId}, {withDeleted: false}, undefined, "_id name");
        }

        const groupIds: ObjectId[] = [
            rootId,
            ...(branches as Array<{_id: ObjectId}>).map(b => b._id),
        ];

        const user = await userService.findById(actionUserCtx.userId, {logger, languageCode}, undefined, "roles");
        const now = new Date();
        /** The caller's access in a company of the group; none where they are not an active, unlocked member. */
        const accessIn = async (groupCompanyId: ObjectId): Promise<UserContext | undefined> => {
            if (groupCompanyId.equals(companyId)) return actionUserCtx;
            const membership = user?.roles.find((role) => String(nestedEntityToRef(role.company)) === String(groupCompanyId));
            if (!user || !membership || membership.active !== "active" || (membership.lockedOutUntil && membership.lockedOutUntil > now)) return undefined;
            const {isAdmin, permissions} = await user.getCompanyAccess(groupCompanyId);
            return {userId: actionUserCtx.userId, orgId: String(groupCompanyId), isSelf: actionUserCtx.isSelf, isAdmin, permissions};
        };
        const readable = await Promise.all(groupIds.map(async (groupCompanyId) => {
            const access = await accessIn(groupCompanyId);
            const can = (collection: typeof GROUP_COLLECTIONS[number]) => access !== undefined && canReadCollectedFields(collection, access, languageCode);
            return {companyId: groupCompanyId, units: can("units"), sales: can("sales"), commissions: can("commissions"), leases: can("leases")};
        }));
        const branchReads = readable.filter((read) => read.units || read.sales || read.commissions || read.leases);

        const companyNames: Record<string, string> = {[rootId.toString()]: rootName};
        for (const b of branches as Array<{_id: ObjectId; name: string}>) {
            companyNames[b._id.toString()] = b.name;
        }

        const branchKpis: BranchKpi[] = await Promise.all(branchReads.map((read) => withTenant(read.companyId, async () => {
            const cid = read.companyId;
            const emptyAgg: never[] = [];
            const [unitAgg, saleAgg, commAgg, leaseAgg] = await Promise.all([
                read.units ? unitService.aggregate([
                    {$match: {company: cid, deletedAt: null}},
                    {$group: {
                        _id: null,
                        total: {$sum: 1},
                        available: {$sum: {$cond: [{$eq: ["$status", UnitStatus.AVAILABLE]}, 1, 0]}},
                        sold: {$sum: {$cond: [{$eq: ["$status", UnitStatus.SOLD]}, 1, 0]}},
                        rented: {$sum: {$cond: [{$eq: ["$status", UnitStatus.RENTED]}, 1, 0]}},
                    }},
                ]) : Promise.resolve(emptyAgg),
                read.sales ? saleService.aggregate([
                    {$match: {company: cid, deletedAt: null}},
                    {$group: {_id: null, revenue: {$sum: {$toDouble: {$ifNull: ["$finalPrice", 0]}}}}},
                ]) : Promise.resolve(emptyAgg),
                read.commissions ? commissionService.aggregate([
                    {$match: {company: cid, deletedAt: null, status: {$ne: CommissionStatus.VOIDED}}},
                    {$group: {_id: null, amount: {$sum: {$toDouble: {$ifNull: ["$amount", 0]}}}}},
                ]) : Promise.resolve(emptyAgg),
                read.leases ? leaseService.aggregate([
                    {$match: {company: cid, deletedAt: null, status: LeaseStatus.ACTIVE}},
                    {$group: {_id: null, count: {$sum: 1}}},
                ]) : Promise.resolve(emptyAgg),
            ]);
            const [u] = unitAgg as Array<{total?: number; available?: number; sold?: number; rented?: number}>;
            const [sl] = saleAgg as Array<{revenue?: number}>;
            const [c] = commAgg as Array<{amount?: number}>;
            const [l] = leaseAgg as Array<{count?: number}>;
            const sid = cid.toString();
            return {
                companyId: sid,
                companyName: companyNames[sid] ?? sid,
                totalUnits: u?.total ?? 0,
                availableUnits: u?.available ?? 0,
                soldUnits: u?.sold ?? 0,
                rentedUnits: u?.rented ?? 0,
                totalRevenue: toNumber(sl?.revenue),
                totalCommissions: toNumber(c?.amount),
                activeLeases: l?.count ?? 0,
                openSnags: 0,
            };
        }, "propertyManagement")));

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
