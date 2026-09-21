import * as fs from "fs";
import * as path from "path";
import {randomUUID} from "crypto";
import {CLIENT_SIDE, CONSTANTS, EMAIL, clientHostFor} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import {
    currentYear,
    escapeHtml,
    layoutStrings,
    localized,
    noteHtml,
    pushRow,
    pushUnitLocationRows,
    scheduleTableHtml,
    summaryCardHtml,
    type SummaryRow,
} from "./emailLayout";
import type {PaymentScheduleRowForEmail} from "./salePlanSummaryForEmail";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "salesStaffAlert");

type UnitContext = {
    unitId?: string;
    unitNumber?: string;
    unitDisplayName?: string;
    projectName?: string;
    edificeName?: string;
    floorName?: string;
};

export type SalesStaffAlertEmail = UnitContext & {
    /** Recipient. */
    email: string;
    fullName: string;
    languageCode: string;
    companyId: string;
    companyName: string;
} & (
    | {
          kind: "sale_created";
          saleId: string;
          saleCode?: string;
          pendingApproval: boolean;
          finalPriceDisplay?: string;
          unitPriceDisplay?: string;
          localDiscountDisplay?: string;
          downPaymentDisplay?: string;
          downPaymentPaid?: boolean;
          numberOfInstallments?: number;
          paymentSchedule?: PaymentScheduleRowForEmail[];
          paymentType: "cash" | "payment_plan";
          buyerName?: string;
          soldByName?: string;
      }
    | {
          kind: "reservation_created";
          reservationId: string;
          reservationCode?: string;
          clientName?: string;
          depositDisplay?: string;
          expirationDateFormatted?: string;
          createdByName?: string;
      }
);

/** Copy suffix: `subject{X}`, `heading{X}`, `preheader{X}`, `intro{X}`. */
type Variant = "Sale" | "SalePending" | "Reservation";

function ctaButtonHtml(label: string, url: string): string {
    if (!url) {
        return "";
    }
    const href = escapeHtml(url);
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr>
    <td align="center" style="padding:28px 0 4px;">
      <a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:100%;color:#111114;text-decoration:none;background-color:#cca250;border-radius:10px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Panel list URL that opens already filtered to one record, using sinfonia's list URL contract
 * (`filterUrl.ts`): `filter` = base64url(JSON FilterBuilder DSL) on the record code (`name`),
 * falling back to the `qf_unit` quick filter when the record has no code.
 */
export function filteredListUrl(
    host: string,
    listPath: string,
    record: {code?: string; unitId?: string; unitLabel?: string},
): string {
    if (!host) return "";
    const params = new URLSearchParams();
    if (record.code) {
        const dsl = {
            id: randomUUID(),
            operator: "and",
            rules: [{id: randomUUID(), field: "name", operator: "equals", value: record.code}],
            groups: [],
        };
        params.set("filter", Buffer.from(JSON.stringify(dsl), "utf8").toString("base64url"));
    } else if (record.unitId) {
        params.set("qf_unit", record.unitId);
        if (record.unitLabel) params.set("qf_unit_label", record.unitLabel);
    }
    const qs = params.toString();
    return `${host}${listPath}${qs ? `?${qs}` : ""}`;
}

function unitRows(rows: SummaryRow[], loc: Record<string, string>, data: UnitContext): void {
    pushUnitLocationRows(rows, loc, data);
    pushRow(rows, loc.labelUnit, data.unitNumber);
    pushRow(rows, loc.labelUnitName, data.unitDisplayName);
}

/** Internal alert to a staff watcher configured under Sales & handover → Notifications. */
export async function sendSalesStaffAlertMail(data: SalesStaffAlertEmail): Promise<void> {
    if (!EMAIL.ENABLED) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US";
    const strings = loadEmailStrings(["salesStaffAlert"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    const companyName = data.companyName ?? "";
    const unitNumber = data.unitNumber ?? "—";
    const panelHost = clientHostFor("core");

    const rows: SummaryRow[] = [];
    let variant: Variant;
    let bodyFile: string;
    let summaryTitle: string;
    let ctaLabel: string;
    let ctaUrl = "";
    let scheduleTable = "";

    if (data.kind === "sale_created") {
        variant = data.pendingApproval ? "SalePending" : "Sale";
        bodyFile = "body-sale-created.html";
        summaryTitle = loc.summaryTitleSale ?? "";
        ctaLabel = loc.ctaSale ?? "";
        ctaUrl = filteredListUrl(panelHost, "/realEstate/sales", {code: data.saleCode, unitId: data.unitId, unitLabel: data.unitNumber});

        // Same order as the buyer's confirmation (saleNotifiers → buildSaleCreatedSummaryHtml).
        pushRow(rows, loc.labelReference, data.saleCode);
        unitRows(rows, loc, data);
        pushRow(rows, loc.labelUnitPrice, data.unitPriceDisplay);
        if (data.downPaymentDisplay) {
            const status =
                data.downPaymentPaid == null ? undefined : data.downPaymentPaid ? loc.downPaymentPaid : loc.downPaymentNotPaid;
            pushRow(rows, loc.labelDownPayment, status ? `${data.downPaymentDisplay} (${status})` : data.downPaymentDisplay);
        }
        pushRow(rows, loc.labelLocalDiscount, data.localDiscountDisplay);
        pushRow(rows, loc.labelFinalPrice, data.finalPriceDisplay);
        pushRow(rows, loc.labelPaymentType, data.paymentType === "payment_plan" ? loc.paymentTypePlan : loc.paymentTypeCash);
        if (data.numberOfInstallments != null && data.numberOfInstallments > 0) {
            pushRow(rows, loc.labelInstallmentCount, String(data.numberOfInstallments));
        }
        scheduleTable = data.paymentType === "payment_plan" ? scheduleTableHtml(loc, data.paymentSchedule) : "";
        pushRow(rows, loc.labelBuyer, data.buyerName);
        pushRow(rows, loc.labelSoldBy, data.soldByName);
    } else {
        variant = "Reservation";
        bodyFile = "body-reservation-created.html";
        summaryTitle = loc.summaryTitleReservation ?? "";
        ctaLabel = loc.ctaReservation ?? "";
        ctaUrl = filteredListUrl(panelHost, "/realEstate/reservations", {code: data.reservationCode, unitId: data.unitId, unitLabel: data.unitNumber});

        pushRow(rows, loc.labelReference, data.reservationCode);
        unitRows(rows, loc, data);
        pushRow(rows, loc.labelClient, data.clientName);
        pushRow(rows, loc.labelDeposit, data.depositDisplay);
        pushRow(rows, loc.labelExpiration, data.expirationDateFormatted);
        pushRow(rows, loc.labelCreatedBy, data.createdByName);
    }

    const safeCompanyName = escapeHtml(companyName);
    let bodyInner = fs.readFileSync(path.join(TEMPLATE_DIR, bodyFile), "utf8");
    bodyInner = applyPlaceholders(bodyInner, {
        intro: localized(strings, `intro${variant}`, {companyName: safeCompanyName}),
        detailsSummary: summaryCardHtml(summaryTitle, rows),
        scheduleTable,
        pendingNote: variant === "SalePending" ? noteHtml(loc.pendingNote ?? "") : "",
        ctaButton: ctaButtonHtml(ctaLabel, ctaUrl),
    });

    let emailTemplate = fs.readFileSync(path.join(TEMPLATE_DIR, "salesStaffAlert.html"), "utf8");
    emailTemplate = applyPlaceholders(emailTemplate, layoutStrings(strings, `heading${variant}`, `preheader${variant}`));
    emailTemplate = applyPlaceholders(emailTemplate, {
        greeting: localized(strings, "greeting", {fullName: escapeHtml(data.fullName)}),
        bodyInner,
        companyName: safeCompanyName,
        unitNumber: escapeHtml(unitNumber),
        pageName: CLIENT_SIDE.NAME ?? "",
        year: currentYear(),
    });

    const subject = applyPlaceholders(loc[`subject${variant}`] ?? "", {companyName, unitNumber});

    await sendMail(data.companyId, {
        to: data.email,
        subject,
        html: emailTemplate,
    });
}
