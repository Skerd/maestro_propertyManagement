import {ObjectId} from "mongodb";
import {Response} from "express";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {computeUnitCostSubtotal} from "../../../utilities/mappers/unitCost/unitCostMapper.dto";
import {erpExportFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/erpExport/erpExport.form.validator";
import type {
    ErpExportResponse,
    ErpSaleRow,
    ErpCommissionRow,
    ErpPaymentPlanRow,
    ErpRentalPaymentRow,
    ErpUnitCostRow,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/erpExport/erpExport.response.type";
import type {ErpExportFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/erpExport/erpExport.form.type";
import {
    assertAnyCollectedRead,
    canReadCollectedFields,
    collectedFieldReader,
    omitRowKeys,
    type RowFieldSources,
    unreadableRowKeys,
} from "@propertyManagement/utilities/security/canReadCollectedFields";
import {
    getErpExportColumnLabel,
    getErpExportDatasetSectionLabel,
    getErpExportExportedAtLabel,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/erpExport/erpExport.columnLabels";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {commissionService} from "@propertyManagement/database/schemas/commission/commission.service";
import {paymentPlanService} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan.service";
import {rentalPaymentService} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment.service";
import {unitCostService} from "@propertyManagement/database/schemas/unitCost/unitCost.service";
import {localDayInterval} from "@coreModule/utilities/time/timeWindows";
import {type DayRange, inDayRange, parseDayRange} from "../../../utilities/hubShared/dayRange";

export const basePath = "/api/realEstate/erpExport";

const router = Router();
export {router};

router.post(
    "",
    authMW("private"),
    rateLimiter({windowMs: 60_000, max: 20}),
    validateFormZod(erpExportFormSchema),
    asyncHandler(erpExportHandler),
);

type ErpExportParams = AuthenticatedMWType & ErpExportFormType;

/** Field-level read (SEC-09): where each exported column comes from. A hidden column is left out of the file. */
const SALE_SOURCES: RowFieldSources<ErpSaleRow> = {
    name: [["sales", "name"]],
    unitName: [["sales", "unit"]],
    buyerName: [["sales", "buyer"]],
    saleDate: [["sales", "saleDate"]],
    salePrice: [["sales", "finalPrice"]],
    currency: [["sales", "saleCurrency"]],
    status: [["sales", "approvalStatus"], ["sales", "paymentType"]],
};

const COMMISSION_SOURCES: RowFieldSources<ErpCommissionRow> = {
    agentName: [["commissions", "agent"]],
    saleId: [["commissions", "sale"]],
    saleName: [["commissions", "sale"], ["sales", "name"]],
    amount: [["commissions", "amount"]],
    currency: [["commissions", "currency"]],
    status: [["commissions", "status"]],
};

const INSTALLMENT_SOURCES: RowFieldSources<ErpPaymentPlanRow> = {
    name: [["paymentplans", "name"]],
    saleName: [["paymentplans", "sale"], ["sales", "name"]],
    installmentNumber: [["paymentplans", "installments.installmentNumber"]],
    dueDate: [["paymentplans", "installments.dueDate"]],
    amount: [["paymentplans", "installments.amount"]],
    currency: [["paymentplans", "sale"], ["sales", "saleCurrency"]],
    status: [["paymentplans", "installments.status"]],
    paidAt: [["paymentplans", "installments.paidDate"]],
};

const RENTAL_PAYMENT_SOURCES: RowFieldSources<ErpRentalPaymentRow> = {
    name: [["rentalpayments", "name"]],
    leaseName: [["rentalpayments", "lease"], ["leases", "name"]],
    unitName: [["rentalpayments", "unit"]],
    dueDate: [["rentalpayments", "dueDate"]],
    amount: [["rentalpayments", "amount"]],
    paidAmount: [["rentalpayments", "paidAmount"]],
    currency: [["rentalpayments", "currency"]],
    status: [["rentalpayments", "status"]],
};

const UNIT_COST_SOURCES: RowFieldSources<ErpUnitCostRow> = {
    name: [["unitcosts", "name"]],
    unitName: [["unitcosts", "unit"]],
    projectName: [["unitcosts", "project"]],
    purchaseDate: [["unitcosts", "purchaseDate"]],
    totalAmount: [["unitcosts", "expenditureItems"]],
    currency: [["unitcosts", "currency"]],
    verificationStatus: [["unitcosts", "verificationStatus"]],
    paymentStatus: [["unitcosts", "paymentStatus"]],
};

function toNum(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "object" && v !== null && "toString" in v) {
        return parseFloat(String((v as {toString: () => string}).toString())) || 0;
    }
    return parseFloat(String(v)) || 0;
}

/** A stored local day (`YYYY-MM-DD`, D115) as exported, or "" when there is none. */
function dayOf(v: unknown): string {
    return typeof v === "string" ? v : "";
}

/** A Mongo range on a local-day field; days compare as text. */
function dateFilter(field: string, range: DayRange): Record<string, unknown> {
    if (!range.from && !range.to) return {};
    const clause: Record<string, string> = {};
    if (range.from) clause.$gte = range.from;
    if (range.to) clause.$lte = range.to;
    return {[field]: clause};
}

/** A Mongo range on an instant field that covers the company's days `range.from` through `range.to`. */
function instantFilter(field: string, range: DayRange, timeZone: string): Record<string, unknown> {
    if (!range.from && !range.to) return {};
    const clause: Record<string, Date> = {};
    if (range.from) clause.$gte = localDayInterval(range.from, timeZone).start;
    if (range.to) clause.$lt = localDayInterval(range.to, timeZone).end;
    return {[field]: clause};
}

function escapeCsvCell(v: unknown): string {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
}

function toCsvRowValues(row: Record<string, unknown>, keys: string[]): string {
    return keys.map((k) => escapeCsvCell(row[k])).join(",");
}

function toCsv(rows: Record<string, unknown>[], languageCode: string): string {
    if (!rows.length) return "";
    const keys = Object.keys(rows[0]);
    const headers = keys.map((k) => escapeCsvCell(getErpExportColumnLabel(k, languageCode))).join(",");
    return [headers, ...rows.map((row) => toCsvRowValues(row, keys))].join("\n");
}

async function unitIdsForProject(
    projectId: string,
    companyId: ObjectId,
    logger: ErpExportParams["logger"],
    languageCode: string,
): Promise<ObjectId[]> {
    const units = await unitService.find(
        {project: new ObjectId(projectId), company: companyId},
        {logger, languageCode},
        [],
        "_id",
        {},
        10_000,
        0,
    );
    return units.map((u) => u._id);
}

async function erpExportHandler(
    params: ErpExportParams,
    _queryParams: unknown,
    _req: unknown,
    res: Response,
): Promise<ErpExportResponse | void> {
    const {logger, languageCode, actionUserCtx, company, datasets, format = "json", dateFrom, dateTo, projectId} = params;

    logger.start("Generating ERP export...");
    const datasetCollections = {
        sales: "sales",
        commissions: "commissions",
        paymentPlans: "paymentplans",
        rentalPayments: "rentalpayments",
        unitCosts: "unitcosts",
    } as const;
    const allowedDatasets = datasets.filter((dataset): dataset is keyof typeof datasetCollections =>
        dataset in datasetCollections
        && canReadCollectedFields(datasetCollections[dataset as keyof typeof datasetCollections], actionUserCtx, languageCode),
    );
    assertAnyCollectedRead(allowedDatasets.length > 0, languageCode);
    const read = collectedFieldReader(actionUserCtx, languageCode);

    const companyId = company._id as ObjectId;
    const range = parseDayRange(dateFrom, dateTo);
    const baseMatch = {company: companyId, deletedAt: null};

    let projectUnitIds: ObjectId[] | null = null;
    if (projectId && ObjectId.isValid(projectId)) {
        projectUnitIds = await unitIdsForProject(projectId, companyId, logger, languageCode);
    }

    const result: ErpExportResponse = {exportedAt: new Date().toISOString()};
    if (dateFrom) result.dateFrom = dateFrom;
    if (dateTo) result.dateTo = dateTo;

    // ── Sales ─────────────────────────────────────────────────────────────────
    if (allowedDatasets.includes("sales")) {
        const saleFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("saleDate", range),
        };
        if (projectUnitIds) {
            saleFilter.unit = {$in: projectUnitIds};
        }

        const saleDocs = await saleService.findForErpExport(saleFilter);

        const hidden = unreadableRowKeys(SALE_SOURCES, read);
        result.sales = (saleDocs as Record<string, unknown>[]).map((s): ErpSaleRow => {
            const buyer = s.buyer as {name?: string; surname?: string} | undefined;
            const buyerName = buyer
                ? [buyer.name, buyer.surname].filter(Boolean).join(" ")
                : undefined;
            const unit = s.unit as {name?: string; unitNumber?: string} | undefined;
            const currency = s.saleCurrency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: s._id?.toString() ?? "",
                name: String(s.name ?? ""),
                unitName: unit?.name ?? unit?.unitNumber ?? "",
                buyerName,
                saleDate: dayOf(s.saleDate),
                salePrice: toNum(s.finalPrice),
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(s.approvalStatus ?? s.paymentType ?? ""),
            };
        }).map((row) => omitRowKeys(row, hidden));
    }

    // ── Commissions ───────────────────────────────────────────────────────────
    if (allowedDatasets.includes("commissions")) {
        const commFilter: Record<string, unknown> = {
            ...baseMatch,
            ...instantFilter("createdAt", range, params.companyTimeZone),
        };

        const commDocs = await commissionService.findForErpExport(commFilter);

        const hidden = unreadableRowKeys(COMMISSION_SOURCES, read);
        result.commissions = (commDocs as Record<string, unknown>[]).map((c): ErpCommissionRow => {
            const agent = c.agent as {name?: string; surname?: string} | undefined;
            const agentName = agent
                ? [agent.name, agent.surname].filter(Boolean).join(" ")
                : undefined;
            const sale = c.sale as {_id?: ObjectId; name?: string} | undefined;
            const currency = c.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: c._id?.toString() ?? "",
                name: String(c.name ?? ""),
                agentName,
                saleId: sale?._id?.toString() ?? "",
                saleName: sale?.name ?? "",
                amount: toNum(c.amount),
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(c.status ?? ""),
            };
        }).map((row) => omitRowKeys(row, hidden));
    }

    // ── Payment Plan Installments ──────────────────────────────────────────────
    if (allowedDatasets.includes("paymentPlans")) {
        const ppFilter: Record<string, unknown> = {...baseMatch};

        if (projectUnitIds) {
            const saleIds = await saleService.findIdsLean({
                ...baseMatch,
                unit: {$in: projectUnitIds},
            });
            ppFilter.sale = {$in: saleIds.map((s) => s._id)};
        }

        const ppDocs = await paymentPlanService.findForErpExport(ppFilter);

        const rows: ErpPaymentPlanRow[] = [];
        for (const pp of ppDocs as Record<string, unknown>[]) {
            const sale = pp.sale as {
                name?: string;
                saleCurrency?: {abbreviation?: string; symbol?: string};
            } | undefined;
            const currencyLabel =
                sale?.saleCurrency?.abbreviation ?? sale?.saleCurrency?.symbol ?? "";
            const saleName = sale?.name ?? "";

            for (const inst of (pp.installments as Record<string, unknown>[]) ?? []) {
                const due = dayOf(inst.dueDate);
                if (due && !inDayRange(due, range)) continue;
                rows.push({
                    id: `${pp._id}_${inst.installmentNumber}`,
                    name: String(pp.name ?? ""),
                    saleName,
                    installmentNumber: Number(inst.installmentNumber),
                    dueDate: due,
                    amount: toNum(inst.amount),
                    currency: currencyLabel,
                    status: String(inst.status ?? ""),
                    paidAt: dayOf(inst.paidDate) || undefined,
                });
            }
        }
        const hidden = unreadableRowKeys(INSTALLMENT_SOURCES, read);
        result.paymentPlanInstallments = rows.map((row) => omitRowKeys(row, hidden));
    }

    // ── Rental Payments ───────────────────────────────────────────────────────
    if (allowedDatasets.includes("rentalPayments")) {
        const rpFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("dueDate", range),
        };

        const rpDocs = await rentalPaymentService.findForErpExport(rpFilter);

        const hidden = unreadableRowKeys(RENTAL_PAYMENT_SOURCES, read);
        result.rentalPayments = (rpDocs as Record<string, unknown>[]).map((rp): ErpRentalPaymentRow => {
            const lease = rp.lease as {name?: string} | undefined;
            const unit = rp.unit as {name?: string; unitNumber?: string} | undefined;
            const currency = rp.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: rp._id?.toString() ?? "",
                name: String(rp.name ?? ""),
                leaseName: lease?.name ?? "",
                unitName: unit?.name ?? unit?.unitNumber ?? "",
                dueDate: dayOf(rp.dueDate),
                amount: toNum(rp.amount),
                paidAmount: rp.paidAmount != null ? toNum(rp.paidAmount) : undefined,
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(rp.status ?? ""),
            };
        }).map((row) => omitRowKeys(row, hidden));
    }

    // ── Unit Costs ────────────────────────────────────────────────────────────
    if (allowedDatasets.includes("unitCosts")) {
        const ucFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("purchaseDate", range),
        };
        if (projectId && ObjectId.isValid(projectId)) {
            ucFilter.project = new ObjectId(projectId);
        }

        const ucDocs = await unitCostService.findForErpExport(ucFilter);

        const hidden = unreadableRowKeys(UNIT_COST_SOURCES, read);
        result.unitCosts = ucDocs.map((uc): ErpUnitCostRow => {
            const unit = uc.unit as {name?: string; unitNumber?: string} | undefined;
            const project = uc.project as {name?: string} | undefined;
            const currency = uc.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: uc._id?.toString() ?? "",
                name: String(uc.name ?? ""),
                unitName: unit?.name ?? unit?.unitNumber ?? undefined,
                projectName: project?.name ?? undefined,
                purchaseDate: dayOf(uc.purchaseDate),
                totalAmount: computeUnitCostSubtotal(uc),
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                verificationStatus: String(uc.verificationStatus ?? ""),
                paymentStatus: String(uc.paymentStatus ?? ""),
            };
        }).map((row) => omitRowKeys(row, hidden));
    }

    logger.finish("ERP export generated");

    if (format === "csv") {
        const exportedAtLabel = escapeCsvCell(getErpExportExportedAtLabel(languageCode));
        const sections: string[] = [`${exportedAtLabel},${result.exportedAt}`];
        if (result.sales?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("sales", languageCode)}\n` + toCsv(result.sales as Record<string, unknown>[], languageCode));
        }
        if (result.commissions?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("commissions", languageCode)}\n` + toCsv(result.commissions as Record<string, unknown>[], languageCode));
        }
        if (result.paymentPlanInstallments?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("paymentPlans", languageCode)}\n` + toCsv(result.paymentPlanInstallments as Record<string, unknown>[], languageCode));
        }
        if (result.rentalPayments?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("rentalPayments", languageCode)}\n` + toCsv(result.rentalPayments as Record<string, unknown>[], languageCode));
        }
        if (result.unitCosts?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("unitCosts", languageCode)}\n` + toCsv(result.unitCosts as Record<string, unknown>[], languageCode));
        }

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="erp-export-${Date.now()}.csv"`);
        res.send(sections.join("\n\n"));
        return;
    }

    return result;
}
