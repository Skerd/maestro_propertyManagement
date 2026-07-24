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
import BoqItem from "../../../database/schemas/boqItem/boqItem";
import CostCommitment from "../../../database/schemas/costCommitment/costCommitment";
import ProgressClaim from "../../../database/schemas/progressClaim/progressClaim";
import Permit from "../../../database/schemas/permit/permit";
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
    ErpBoqItemRow,
    ErpCostCommitmentRow,
    ErpProgressClaimRow,
    ErpPermitRow,
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

    // ── BOQ Items ─────────────────────────────────────────────────────────────
    if (datasets.includes("boqItems")) {
        const boqFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("createdAt", from, to),
        };
        if (projectId && ObjectId.isValid(projectId)) {
            boqFilter.project = new ObjectId(projectId);
        }

        const boqDocs = await BoqItem.find(boqFilter)
            .select("name title project budget wbsCode trade plannedQty plannedRate plannedAmount actualAmount currency status")
            .populate("project", "name")
            .populate("budget", "name title")
            .populate("currency", "abbreviation symbol")
            .lean();

        result.boqItems = (boqDocs as Record<string, unknown>[]).map((b): ErpBoqItemRow => {
            const project = b.project as {name?: string} | undefined;
            const budget = b.budget as {name?: string; title?: string} | undefined;
            const currency = b.currency as {abbreviation?: string; symbol?: string} | undefined;
            const planned = toNum(b.plannedAmount);
            const actual = toNum(b.actualAmount);
            return {
                id: b._id?.toString() ?? "",
                name: String(b.name ?? ""),
                title: String(b.title ?? ""),
                projectName: project?.name ?? undefined,
                budgetName: budget?.name ?? budget?.title ?? undefined,
                wbsCode: b.wbsCode != null ? String(b.wbsCode) : undefined,
                trade: b.trade != null ? String(b.trade) : undefined,
                plannedQty: b.plannedQty != null ? toNum(b.plannedQty) : undefined,
                plannedRate: b.plannedRate != null ? toNum(b.plannedRate) : undefined,
                plannedAmount: b.plannedAmount != null ? planned : undefined,
                actualAmount: b.actualAmount != null ? actual : undefined,
                variance: b.plannedAmount != null || b.actualAmount != null ? planned - actual : undefined,
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(b.status ?? ""),
            };
        });
    }

    // ── Cost Commitments ──────────────────────────────────────────────────────
    if (datasets.includes("costCommitments")) {
        const ccFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("createdAt", from, to),
        };
        if (projectId && ObjectId.isValid(projectId)) {
            ccFilter.project = new ObjectId(projectId);
        }

        const ccDocs = await CostCommitment.find(ccFilter)
            .select("name title project constructorRef committedAmount retentionPercent issuedAt currency status")
            .populate("project", "name")
            .populate("constructorRef", "name")
            .populate("currency", "abbreviation symbol")
            .lean();

        result.costCommitments = (ccDocs as Record<string, unknown>[]).map((c): ErpCostCommitmentRow => {
            const project = c.project as {name?: string} | undefined;
            const ctor = c.constructorRef as {name?: string} | undefined;
            const currency = c.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: c._id?.toString() ?? "",
                name: String(c.name ?? ""),
                title: String(c.title ?? ""),
                projectName: project?.name ?? undefined,
                constructorName: ctor?.name ?? undefined,
                committedAmount: toNum(c.committedAmount),
                retentionPercent: c.retentionPercent != null ? toNum(c.retentionPercent) : undefined,
                issuedAt: c.issuedAt ? toIso(c.issuedAt) : undefined,
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(c.status ?? ""),
            };
        });
    }

    // ── Progress Claims ───────────────────────────────────────────────────────
    if (datasets.includes("progressClaims")) {
        const pcFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("createdAt", from, to),
        };
        if (projectId && ObjectId.isValid(projectId)) {
            pcFilter.project = new ObjectId(projectId);
        }

        const pcDocs = await ProgressClaim.find(pcFilter)
            .select("name title project constructionContract claimPeriodStart claimPeriodEnd amount certifiedAmount currency status")
            .populate("project", "name")
            .populate("constructionContract", "name title")
            .populate("currency", "abbreviation symbol")
            .lean();

        result.progressClaims = (pcDocs as Record<string, unknown>[]).map((p): ErpProgressClaimRow => {
            const project = p.project as {name?: string} | undefined;
            const contract = p.constructionContract as {name?: string; title?: string} | undefined;
            const currency = p.currency as {abbreviation?: string; symbol?: string} | undefined;
            return {
                id: p._id?.toString() ?? "",
                name: String(p.name ?? ""),
                title: String(p.title ?? ""),
                projectName: project?.name ?? undefined,
                contractName: contract?.name ?? contract?.title ?? undefined,
                claimPeriodStart: p.claimPeriodStart ? toIso(p.claimPeriodStart) : undefined,
                claimPeriodEnd: p.claimPeriodEnd ? toIso(p.claimPeriodEnd) : undefined,
                amount: toNum(p.amount),
                certifiedAmount: p.certifiedAmount != null ? toNum(p.certifiedAmount) : undefined,
                currency: currency?.abbreviation ?? currency?.symbol ?? "",
                status: String(p.status ?? ""),
            };
        });
    }

    // ── Permits ───────────────────────────────────────────────────────────────
    if (datasets.includes("permits")) {
        const permitFilter: Record<string, unknown> = {
            ...baseMatch,
            ...dateFilter("createdAt", from, to),
        };
        if (projectId && ObjectId.isValid(projectId)) {
            permitFilter.project = new ObjectId(projectId);
        }

        const permitDocs = await Permit.find(permitFilter)
            .select("name title project edifice permitType authority referenceNumber submittedAt approvedAt expiresAt status")
            .populate("project", "name")
            .populate("edifice", "name")
            .lean();

        result.permits = (permitDocs as Record<string, unknown>[]).map((p): ErpPermitRow => {
            const project = p.project as {name?: string} | undefined;
            const edifice = p.edifice as {name?: string} | undefined;
            return {
                id: p._id?.toString() ?? "",
                name: String(p.name ?? ""),
                title: String(p.title ?? ""),
                projectName: project?.name ?? undefined,
                edificeName: edifice?.name ?? undefined,
                permitType: String(p.permitType ?? ""),
                authority: p.authority != null ? String(p.authority) : undefined,
                referenceNumber: p.referenceNumber != null ? String(p.referenceNumber) : undefined,
                submittedAt: p.submittedAt ? toIso(p.submittedAt) : undefined,
                approvedAt: p.approvedAt ? toIso(p.approvedAt) : undefined,
                expiresAt: p.expiresAt ? toIso(p.expiresAt) : undefined,
                status: String(p.status ?? ""),
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
        if (result.boqItems?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("boqItems", languageCode)}\n` + toCsv(result.boqItems as Record<string, unknown>[], languageCode));
        }
        if (result.costCommitments?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("costCommitments", languageCode)}\n` + toCsv(result.costCommitments as Record<string, unknown>[], languageCode));
        }
        if (result.progressClaims?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("progressClaims", languageCode)}\n` + toCsv(result.progressClaims as Record<string, unknown>[], languageCode));
        }
        if (result.permits?.length) {
            sections.push(`# ${getErpExportDatasetSectionLabel("permits", languageCode)}\n` + toCsv(result.permits as Record<string, unknown>[], languageCode));
        }

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="erp-export-${Date.now()}.csv"`);
        res.send(sections.join("\n\n"));
        return;
    }

    return result;
}
