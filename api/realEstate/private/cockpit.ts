/**
 * cockpit — cross-project KPI cockpit with Ampel status (§3.L).
 *
 * POST /api/realEstate/cockpit { projectId? } returns traffic-light KPIs:
 * cost variance %, open RFIs, delayed milestones, open tenders, approval backlog,
 * unpaid approved invoices. Company-wide unless a projectId is supplied.
 */

import {ObjectId} from "mongodb";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import BoqItem from "../../../database/schemas/boqItem/boqItem";
import ContractorInvoice from "../../../database/schemas/contractorInvoice/contractorInvoice";
import Rfi from "../../../database/schemas/rfi/rfi";
import Milestone from "../../../database/schemas/milestone/milestone";
import Tender from "../../../database/schemas/tender/tender";
import ApprovalRequest from "../../../database/schemas/approvalRequest/approvalRequest";
import type {CockpitResponse, CockpitKpi} from "armonia/src/modules/propertyManagement/api/realEstate/private/cockpit/cockpit.response.type";

export const basePath = "/api/realEstate/cockpit";
export const router = Router();

function ampel(value: number, amberAt: number, redAt: number, higherIsWorse = true): "green" | "amber" | "red" {
    if (higherIsWorse) {
        if (value >= redAt) return "red";
        if (value >= amberAt) return "amber";
        return "green";
    }
    if (value <= redAt) return "red";
    if (value <= amberAt) return "amber";
    return "green";
}

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType & {projectId?: string}): Promise<CockpitResponse> => {
        const {company, projectId} = params;
        const companyId = company._id as ObjectId;
        const projectScoped = !!projectId && ObjectId.isValid(projectId);
        const projectMatch = projectScoped ? {project: new ObjectId(projectId)} : {};

        const [estAgg, invAgg, openRfis, delayedMilestones, openTenders, approvalBacklog, unpaidInvoices] = await Promise.all([
            BoqItem.aggregate([
                {$match: {company: companyId, deletedAt: null, status: "active", ...projectMatch}},
                {$group: {_id: null, v: {$sum: {$toDouble: {$ifNull: ["$plannedAmount", 0]}}}}},
            ]),
            ContractorInvoice.aggregate([
                {$match: {company: companyId, deletedAt: null, status: {$ne: "rejected"}, ...projectMatch}},
                {$group: {_id: null, v: {$sum: {$toDouble: {$ifNull: ["$grossAmount", 0]}}}}},
            ]),
            Rfi.countDocuments({company: companyId, deletedAt: null, status: {$in: ["open", "pending"]}, ...projectMatch}),
            Milestone.countDocuments({company: companyId, deletedAt: null, status: {$in: ["delayed", "overdue"]}, ...projectMatch}),
            Tender.countDocuments({company: companyId, deletedAt: null, status: {$in: ["published", "closing"]}, ...(projectScoped ? {project: new ObjectId(projectId)} : {})}),
            ApprovalRequest.countDocuments({company: companyId, deletedAt: null, status: "pending"}),
            ContractorInvoice.countDocuments({company: companyId, deletedAt: null, status: "approved", ...projectMatch}),
        ]);

        const estimated = estAgg[0]?.v ?? 0;
        const invoiced = invAgg[0]?.v ?? 0;
        const variancePct = estimated > 0 ? Math.round(((invoiced - estimated) / estimated) * 1000) / 10 : 0;

        const kpis: CockpitKpi[] = [
            {key: "costVariancePercent", value: variancePct, unit: "%", ampel: ampel(Math.abs(variancePct), 5, 15)},
            {key: "openRfis", value: openRfis, unit: "count", ampel: ampel(openRfis, 5, 15)},
            {key: "delayedMilestones", value: delayedMilestones, unit: "count", ampel: ampel(delayedMilestones, 1, 3)},
            {key: "openTenders", value: openTenders, unit: "count", ampel: "green"},
            {key: "approvalBacklog", value: approvalBacklog, unit: "count", ampel: ampel(approvalBacklog, 3, 10)},
            {key: "unpaidApprovedInvoices", value: unpaidInvoices, unit: "count", ampel: ampel(unpaidInvoices, 5, 15)},
        ];

        return {
            projectId: projectScoped ? String(projectId) : undefined,
            scope: projectScoped ? "project" : "company",
            kpis,
            computedAt: new Date().toISOString(),
        };
    }),
);
