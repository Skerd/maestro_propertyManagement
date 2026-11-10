import {Router} from "express";
import {Decimal128, ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {SalePaymentType} from "../../../database/schemas/sale/sale";
import {userService} from "@coreModule/database/schemas/user/user.service";
import {decimalToNumber} from "@coreModule/utilities/mappers/common.mapper";
import {localDayInterval} from "@coreModule/utilities/time/timeWindows";
import {CommissionStatus} from "../../../database/schemas/commission/commission";
import {ReservationStatus} from "../../../database/schemas/reservation/reservation";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {agentReportFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/agentReport/agentReport.form.validator";
import type {AgentReportResponseType, AgentReportEntry} from "armonia/src/modules/propertyManagement/api/realEstate/private/agentReport/agentReport.response.type";
import type {AgentReportFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/agentReport/agentReport.form.type";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
    collectedFieldReader,
} from "@propertyManagement/utilities/security/canReadCollectedFields";

import {saleService} from "../../../database/schemas/sale/sale.service";
import {reservationService} from "../../../database/schemas/reservation/reservation.service";
import {commissionService} from "../../../database/schemas/commission/commission.service";
export const basePath = "/api/realEstate/agentReport";

const router = Router();
export {router};

const ZERO = Decimal128.fromString("0");

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
    const canReadSales = canReadCollectedFields("sales", params.actionUserCtx, languageCode);
    const canReadReservations = canReadCollectedFields("reservations", params.actionUserCtx, languageCode);
    const canReadCommissions = canReadCollectedFields("commissions", params.actionUserCtx, languageCode);
    assertAnyCollectedRead(canReadSales || canReadReservations || canReadCommissions, languageCode);

    // Field-level read (SEC-09): each figure is grouped by, and counts, fields the caller may read; the rest stay 0.
    const read = collectedFieldReader(params.actionUserCtx, languageCode);
    const salesByAgent = canReadSales && read("sales", "soldBy");
    const salesByType = salesByAgent && read("sales", "paymentType");
    const reservationsByAgent = canReadReservations && read("reservations", "reservedBy");
    const reservationsConverted = reservationsByAgent && read("reservations", "status");
    const commissionsByAgent = canReadCommissions && read("commissions", "agent");
    const commissionTotals = commissionsByAgent && read("commissions", "amount") && read("commissions", "status");
    const commissionRates = commissionsByAgent && read("commissions", "ratePercent");

    // From the start of the first day to the end of the last, in the company's timezone (GLB-09).
    const from = localDayInterval(dateFrom, params.companyTimeZone).start;
    const to   = localDayInterval(dateTo, params.companyTimeZone).end;

    const companyId = company._id;
    const dateFilter = {createdAt: {$gte: from, $lt: to}};
    const baseMatch: Record<string, unknown> = {company: companyId, ...dateFilter, deletedAt: null};

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
    const salesAgg: {_id: ObjectId; total: number; cash: number; pp: number}[] = salesByAgent
        ? await saleService.aggregate([
            {$match: baseMatch},
            {$group: {
                _id:   "$soldBy",
                total: {$sum: 1},
                cash:  {$sum: {$cond: [{$eq: ["$paymentType", SalePaymentType.CASH]}, 1, 0]}},
                pp:    {$sum: {$cond: [{$eq: ["$paymentType", SalePaymentType.PAYMENT_PLAN]}, 1, 0]}},
            }},
        ])
        : [];

    // 2. Aggregate reservations by reservedBy (remove unit filter — reservations may not have unit)
    const resMatch: Record<string, unknown> = {company: companyId, ...dateFilter, deletedAt: null};
    if (agentObjectIds.length > 0) {
        resMatch.reservedBy = {$in: agentObjectIds};
    }
    const resAgg: {_id: ObjectId; total: number; converted: number}[] = reservationsByAgent
        ? await reservationService.aggregate([
            {$match: resMatch},
            {$group: {
                _id:       "$reservedBy",
                total:     {$sum: 1},
                converted: {$sum: {$cond: [{$eq: ["$status", ReservationStatus.CONVERTED]}, 1, 0]}},
            }},
        ])
        : [];

    // 3. Aggregate commissions by agent
    const commMatch: Record<string, unknown> = {company: companyId, ...dateFilter, deletedAt: null};
    if (agentObjectIds.length > 0) {
        commMatch.agent = {$in: agentObjectIds};
    }
    // Amounts are summed as Decimal128 in the database, exactly (D35).
    const commAgg: {_id: ObjectId; paidTotal: Decimal128; pendingTotal: Decimal128; avgRate: number}[] = commissionsByAgent
        ? await commissionService.aggregate([
            {$match: commMatch},
            {$group: {
                _id:          "$agent",
                paidTotal:    {$sum: {$cond: [{$eq: ["$status", CommissionStatus.PAID]},    "$amount", ZERO]}},
                pendingTotal: {$sum: {$cond: [{$eq: ["$status", CommissionStatus.PENDING]}, "$amount", ZERO]}},
                avgRate:      {$avg: "$ratePercent"},
            }},
        ])
        : [];

    // Collect all unique agent IDs and look up names via $lookup on User
    const agentIdSet = new Set<string>();
    agentObjectIds.forEach((id) => agentIdSet.add(id.toString()));
    salesAgg.forEach(r => r._id && agentIdSet.add(r._id.toString()));
    resAgg.forEach(r => r._id && agentIdSet.add(r._id.toString()));
    commAgg.forEach(r => r._id && agentIdSet.add(r._id.toString()));

    const lookupAgentIds = [...agentIdSet].map(id => new ObjectId(id));

    // Agent names through the user service (DB-03), members of this company only.
    const userRows = lookupAgentIds.length > 0
        ? await userService.find(
            {_id: {$in: lookupAgentIds}, "roles.company": companyId},
            {logger, languageCode},
            [],
            "name surname",
        )
        : [];

    const userMap = new Map<string, {_id: string; name?: string; surname?: string}>();
    for (const u of userRows) {
        userMap.set(u._id.toString(), {_id: u._id.toString(), name: u.name, surname: u.surname});
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
        const convertedReservations = reservationsConverted ? res?.converted ?? 0 : 0;
        const conversionRate = totalReservations > 0
            ? Math.round((convertedReservations / totalReservations) * 100)
            : 0;

        entries.push({
            agent,
            totalSales:             sale?.total ?? 0,
            cashSales:              salesByType ? sale?.cash ?? 0 : 0,
            paymentPlanSales:       salesByType ? sale?.pp ?? 0 : 0,
            totalReservations,
            convertedReservations,
            conversionRate,
            totalCommissionsPaid:    commissionTotals ? decimalToNumber(comm?.paidTotal) ?? 0 : 0,
            totalCommissionsPending: commissionTotals ? decimalToNumber(comm?.pendingTotal) ?? 0 : 0,
            averageCommissionRate:   commissionRates ? Math.round((comm?.avgRate ?? 0) * 100) / 100 : 0,
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
