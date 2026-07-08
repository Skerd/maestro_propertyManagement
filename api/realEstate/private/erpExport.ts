import {ObjectId} from "mongodb";
import {Response} from "express";
import {Router} from "express";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import Sale from "../../../database/schemas/sale/sale";
import Commission from "../../../database/schemas/commission/commission";
import PaymentPlan from "../../../database/schemas/paymentPlan/paymentPlan";
import RentalPayment from "../../../database/schemas/rentalPayment/rentalPayment";
import UnitCost from "../../../database/schemas/unitCost/unitCost";
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
    getErpExportColumnLabel,
    getErpExportDatasetSectionLabel,
    getErpExportExportedAtLabel,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/erpExport/erpExport.columnLabels";

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

function toNum(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "object" && v !== null && "toString" in v) {
        return parseFloat(String((v as {toString: () => string}).toString())) || 0;
    }
    return parseFloat(String(v)) || 0;
}

function toIso(v: unknown): string {
    if (!v) return "";
    try {
        return new Date(v as string | number | Date).toISOString();
    } catch {
        return "";
    }
}

function parseDateRange(dateFrom?: string, dateTo?: string): {from?: Date; to?: Date} {
    const range: {from?: Date; to?: Date} = {};
    if (dateFrom) {
        range.from = new Date(dateFrom);
    }
    if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        range.to = to;
    }
    return range;
}

function dateFilter(field: string, from?: Date, to?: Date): Record<string, unknown> {
    if (!from && !to) return {};
    const clause: Record<string, Date> = {};
    if (from) clause.$gte = from;
    if (to) clause.$lte = to;
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
    return units.map((u: {_id: ObjectId}) => u._id);
}

async function erpExportHandler(
    params: ErpExportParams,
    _queryParams: unknown,
    _req: unknown,
    res: Response,
): Promise<ErpExportResponse | void> {
    const {logger, languageCode, company, datasets, format = "json", dateFrom, dateTo, projectId} = params;

    logger.start("Generating ERP export...");

    const companyId = company._id as ObjectId;
    const {from, to} = parseDateRange(dateFrom, dateTo);
    const baseMatch = {company: companyId, deletedAt: {$exists: false}};

    let projectUnitIds: ObjectId[] | null = null;
    if (projectId && ObjectId.isValid(projectId)) {
        projectUnitIds = await unitIdsForProject(projectId, companyId, logger, languageCode);
    }

    const result: ErpExportResponse = {exportedAt: new Date().toISOString()};
    if (dateFrom) result.dateFrom = dateFrom;
    if (dateTo) result.dateTo = dateTo;

    // ── Sales ─────────────────────────────────────────────────────────────────
    if (datasets.includes("sales")) {
        const saleFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("saleDate", from, to),
        };
        if (projectUnitIds) {
            saleFilter.unit = {$in: projectUnitIds};
        }

        const saleDocs = await Sale.find(saleFilter)
            .select("name unit buyer saleDate finalPrice saleCurrency paymentType approvalStatus")
            .populate("unit", "name unitNumber")
            .populate("buyer", "name surname")
            .populate("saleCurrency", "abbreviation symbol")
            .lean();

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
                saleDate: toIso(s.saleDate),
                salePrice: toNum(s.finalPrice),
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(s.approvalStatus ?? s.paymentType ?? ""),
            };
        });
    }

    // ── Commissions ───────────────────────────────────────────────────────────
    if (datasets.includes("commissions")) {
        const commFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("createdAt", from, to),
        };

        const commDocs = await Commission.find(commFilter)
            .select("name agent amount currency status sale createdAt")
            .populate("agent", "name surname")
            .populate("currency", "abbreviation symbol")
            .populate("sale", "name")
            .lean();

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
        });
    }

    // ── Payment Plan Installments ──────────────────────────────────────────────
    if (datasets.includes("paymentPlans")) {
        const ppFilter: Record<string, unknown> = {...baseMatch};

        if (projectUnitIds) {
            const saleIds = await Sale.find({
                ...baseMatch,
                unit: {$in: projectUnitIds},
            })
                .select("_id")
                .lean();
            ppFilter.sale = {$in: saleIds.map((s) => s._id)};
        }

        const ppDocs = await PaymentPlan.find(ppFilter)
            .select("name installments sale")
            .populate({
                path: "sale",
                select: "name saleCurrency",
                populate: {path: "saleCurrency", select: "abbreviation symbol"},
            })
            .lean();

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
                const due = inst.dueDate ? new Date(inst.dueDate as string | Date) : null;
                if (from && due && due < from) continue;
                if (to && due && due > to) continue;
                rows.push({
                    id: `${pp._id}_${inst.installmentNumber}`,
                    name: String(pp.name ?? ""),
                    saleName,
                    installmentNumber: Number(inst.installmentNumber),
                    dueDate: toIso(inst.dueDate),
                    amount: toNum(inst.amount),
                    currency: currencyLabel,
                    status: String(inst.status ?? ""),
                    paidAt: inst.paidDate ? toIso(inst.paidDate) : undefined,
                });
            }
        }
        result.paymentPlanInstallments = rows;
    }

    // ── Rental Payments ───────────────────────────────────────────────────────
    if (datasets.includes("rentalPayments")) {
        const rpFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("dueDate", from, to),
        };

        const rpDocs = await RentalPayment.find(rpFilter)
            .select("name lease unit dueDate amount paidAmount currency status")
            .populate("lease", "name")
            .populate("unit", "name unitNumber")
            .populate("currency", "abbreviation symbol")
            .lean();

        result.rentalPayments = (rpDocs as Record<string, unknown>[]).map((rp): ErpRentalPaymentRow => {
            const lease = rp.lease as {name?: string} | undefined;
            const unit = rp.unit as {name?: string; unitNumber?: string} | undefined;
            const currency = rp.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: rp._id?.toString() ?? "",
                name: String(rp.name ?? ""),
                leaseName: lease?.name ?? "",
                unitName: unit?.name ?? unit?.unitNumber ?? "",
                dueDate: toIso(rp.dueDate),
                amount: toNum(rp.amount),
                paidAmount: rp.paidAmount != null ? toNum(rp.paidAmount) : undefined,
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(rp.status ?? ""),
            };
        });
    }

    // ── Unit Costs ────────────────────────────────────────────────────────────
    if (datasets.includes("unitCosts")) {
        const ucFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("purchaseDate", from, to),
        };
        if (projectId && ObjectId.isValid(projectId)) {
            ucFilter.project = new ObjectId(projectId);
        }

        const ucDocs = await UnitCost.find(ucFilter)
            .select("name unit project purchaseDate expenditureItems currency verificationStatus paymentStatus")
            .populate("unit", "name unitNumber")
            .populate("project", "name")
            .populate("currency", "abbreviation symbol")
            .lean();

        result.unitCosts = (ucDocs as Record<string, unknown>[]).map((uc): ErpUnitCostRow => {
            const unit = uc.unit as {name?: string; unitNumber?: string} | undefined;
            const project = uc.project as {name?: string} | undefined;
            const currency = uc.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: uc._id?.toString() ?? "",
                name: String(uc.name ?? ""),
                unitName: unit?.name ?? unit?.unitNumber ?? undefined,
                projectName: project?.name ?? undefined,
                purchaseDate: toIso(uc.purchaseDate),
                totalAmount: computeUnitCostSubtotal(uc),
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                verificationStatus: String(uc.verificationStatus ?? ""),
                paymentStatus: String(uc.paymentStatus ?? ""),
            };
        });
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
