import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import Sale, {SalePaymentType} from "../../../database/schemas/sale/sale";
import Commission, {CommissionStatus} from "../../../database/schemas/commission/commission";
import Reservation, {ReservationStatus} from "../../../database/schemas/reservation/reservation";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {agentReportFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/agentReport/agentReport.form.validator";
import type {AgentReportResponseType, AgentReportEntry} from "armonia/src/modules/propertyManagement/api/realEstate/private/agentReport/agentReport.response.type";
import type {AgentReportFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/agentReport/agentReport.form.type";

export const basePath = "/api/realEstate/agentReport";

const router = Router();
export {router};

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(agentReportFormSchema),
    asyncHandler(getAgentReport),
);

type GetAgentReportParams = AuthenticatedMWType & AgentReportFormType;

async function getAgentReport(params: GetAgentReportParams): Promise<AgentReportResponseType> {
    const {logger, languageCode, company, dateFrom, dateTo, projectId, agentIds} = params;

    logger.start("Generating agent performance report...");

    const from = new Date(dateFrom);
    const to   = new Date(dateTo);
    // Set `to` to end-of-day
    to.setHours(23, 59, 59, 999);

    const companyId = company._id;
    const dateFilter = {createdAt: {$gte: from, $lte: to}};
    const baseMatch: Record<string, unknown> = {company: companyId, ...dateFilter, deletedAt: {$exists: false}};

    const agentObjectIds = (agentIds ?? [])
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

    if (agentObjectIds.length > 0) {
        baseMatch.soldBy = {$in: agentObjectIds};
    }

    // If projectId provided, restrict to units in that project
    if (projectId && ObjectId.isValid(projectId)) {
        const units = await unitService.find(
            {project: new ObjectId(projectId), company: companyId},
            {logger, languageCode},
            [],
            "_id",
            {},
            10000,
            0,
        );
        const unitIds = units.map((u: any) => u._id);
        baseMatch.unit = {$in: unitIds};
    }

    // 1. Aggregate sales by soldBy
    const salesAgg: {_id: ObjectId; total: number; cash: number; pp: number}[] = await Sale.aggregate([
        {$match: baseMatch},
        {$group: {
            _id:   "$soldBy",
            total: {$sum: 1},
            cash:  {$sum: {$cond: [{$eq: ["$paymentType", SalePaymentType.CASH]}, 1, 0]}},
            pp:    {$sum: {$cond: [{$eq: ["$paymentType", SalePaymentType.PAYMENT_PLAN]}, 1, 0]}},
        }},
    ]);

    // 2. Aggregate reservations by reservedBy (remove unit filter — reservations may not have unit)
    const resMatch: Record<string, unknown> = {company: companyId, ...dateFilter, deletedAt: {$exists: false}};
    if (agentObjectIds.length > 0) {
        resMatch.reservedBy = {$in: agentObjectIds};
    }
    const resAgg: {_id: ObjectId; total: number; converted: number}[] = await Reservation.aggregate([
        {$match: resMatch},
        {$group: {
            _id:       "$reservedBy",
            total:     {$sum: 1},
            converted: {$sum: {$cond: [{$eq: ["$status", ReservationStatus.CONVERTED]}, 1, 0]}},
        }},
    ]);

    // 3. Aggregate commissions by agent
    const commMatch: Record<string, unknown> = {company: companyId, ...dateFilter, deletedAt: {$exists: false}};
    if (agentObjectIds.length > 0) {
        commMatch.agent = {$in: agentObjectIds};
    }
    const commAgg: {_id: ObjectId; paidTotal: number; pendingTotal: number; avgRate: number}[] = await Commission.aggregate([
        {$match: commMatch},
        {$group: {
            _id:          "$agent",
            paidTotal:    {$sum: {$cond: [{$eq: ["$status", CommissionStatus.PAID]},    {$toDouble: "$amount"}, 0]}},
            pendingTotal: {$sum: {$cond: [{$eq: ["$status", CommissionStatus.PENDING]}, {$toDouble: "$amount"}, 0]}},
            avgRate:      {$avg: "$ratePercent"},
        }},
    ]);

    // Collect all unique agent IDs and look up names via $lookup on User
    const agentIdSet = new Set<string>();
    agentObjectIds.forEach((id) => agentIdSet.add(id.toString()));
    salesAgg.forEach(r => r._id && agentIdSet.add(r._id.toString()));
    resAgg.forEach(r => r._id && agentIdSet.add(r._id.toString()));
    commAgg.forEach(r => r._id && agentIdSet.add(r._id.toString()));

    const lookupAgentIds = [...agentIdSet].map(id => new ObjectId(id));

    // Populate user names via aggregate $lookup from User
    const userRows: {_id: ObjectId; name?: string; surname?: string}[] = lookupAgentIds.length > 0
        ? await Sale.db.collection("users").find(
            {_id: {$in: lookupAgentIds}, "roles.company": companyId},
            {projection: {_id: 1, name: 1, surname: 1}},
        ).toArray() as any
        : [];

    const userMap = new Map<string, {_id: string; name?: string; surname?: string}>();
    for (const u of userRows) {
        userMap.set(u._id.toString(), {_id: u._id.toString(), name: (u as any).name, surname: (u as any).surname});
    }

    // Index aggregation results by agent ID
    const salesMap = new Map(salesAgg.map(r => [r._id?.toString(), r]));
    const resMap   = new Map(resAgg.map(r => [r._id?.toString(), r]));
    const commMap  = new Map(commAgg.map(r => [r._id?.toString(), r]));

    const entries: AgentReportEntry[] = [];
    for (const idStr of agentIdSet) {
        const sale = salesMap.get(idStr);
        const res  = resMap.get(idStr);
        const comm = commMap.get(idStr);
        const agent = userMap.get(idStr) ?? {_id: idStr};

        const totalReservations = res?.total ?? 0;
        const convertedReservations = res?.converted ?? 0;
        const conversionRate = totalReservations > 0
            ? Math.round((convertedReservations / totalReservations) * 100)
            : 0;

        entries.push({
            agent,
            totalSales:             sale?.total ?? 0,
            cashSales:              sale?.cash ?? 0,
            paymentPlanSales:       sale?.pp ?? 0,
            totalReservations,
            convertedReservations,
            conversionRate,
            totalCommissionsPaid:    Math.round((comm?.paidTotal ?? 0) * 100) / 100,
            totalCommissionsPending: Math.round((comm?.pendingTotal ?? 0) * 100) / 100,
            averageCommissionRate:   Math.round((comm?.avgRate ?? 0) * 100) / 100,
        });
    }

    // Sort by totalSales desc, then name
    entries.sort((a, b) => {
        if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
        const nameA = `${a.agent.name ?? ""} ${a.agent.surname ?? ""}`.trim().toLowerCase();
        const nameB = `${b.agent.name ?? ""} ${b.agent.surname ?? ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
    });

    logger.finish(`Agent report generated: ${entries.length} agents`);
    return {
        entries,
        period: {from: from.toISOString(), to: to.toISOString()},
    };
}
