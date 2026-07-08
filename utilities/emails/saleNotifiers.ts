import type nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import type {SaleClientEmailEvent} from "../../kafka/types";
import {tryLoadReservationContractForEmail} from "./reservationContractAttachment";

const imagePath = path.join(__dirname, "./static/images/image-1.png");
const imageCID = "imageCID@example.com";
const fallbackLanguageCode = "en-US";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "saleClient");

function canSendEmails(): boolean {
    return EMAIL.ENABLED;
}

function readTemplateHtml(templateDir: string, filename: string): string {
    return fs.readFileSync(path.join(templateDir, filename), "utf8");
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildSaleCreatedSummaryHtml(
    loc: Record<string, string>,
    rowData: {
        saleCode: string;
        unitNumber: string;
        unitDisplayName?: string;
        unitPriceDisplay?: string;
        finalPriceDisplay?: string;
        paymentTypeLabel: string;
        downPaymentDisplay?: string;
        numberOfInstallments?: number;
    }
): string {
    const rows: { label: string; value: string }[] = [];
    rows.push({ label: loc.labelSaleReference ?? "", value: rowData.saleCode });
    rows.push({ label: loc.labelUnit ?? "", value: rowData.unitNumber });
    if (rowData.unitDisplayName?.trim()) {
        rows.push({ label: loc.labelUnitName ?? "", value: rowData.unitDisplayName.trim() });
    }
    if (rowData.unitPriceDisplay?.trim()) {
        rows.push({ label: loc.labelUnitPrice ?? "", value: rowData.unitPriceDisplay.trim() });
    }
    if (rowData.finalPriceDisplay?.trim()) {
        rows.push({ label: loc.labelFinalPrice ?? "", value: rowData.finalPriceDisplay.trim() });
    }
    rows.push({ label: loc.labelPaymentType ?? "", value: rowData.paymentTypeLabel });
    if (rowData.downPaymentDisplay?.trim()) {
        rows.push({ label: loc.labelDownPayment ?? "", value: rowData.downPaymentDisplay.trim() });
    }
    if (rowData.numberOfInstallments != null && rowData.numberOfInstallments > 0) {
        rows.push({ label: loc.labelInstallmentCount ?? "", value: String(rowData.numberOfInstallments) });
    }

    const rowHtml = rows
        .map(
            (r) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #ededed;color:#666666;font-size:13px;width:40%;vertical-align:top;">${escapeHtml(r.label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #ededed;font-size:14px;color:#111111;font-weight:600;vertical-align:top;text-align:right;">${escapeHtml(r.value)}</td>
  </tr>`
        )
        .join("");

    const title = loc.summaryTitle ?? "";
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;background:#ffffff;">
  <tr><td style="padding:16px 20px;background:linear-gradient(180deg,#f8f9fb 0%,#eef1f4 100%);font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(
        title
    )}</td></tr>
  <tr><td style="padding:8px 20px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rowHtml}</table></td></tr>
  </table>`;
}

function buildInstallmentContextHtml(loc: Record<string, string>, data: SaleClientEmailEvent): string {
    const rows: { label: string; value: string }[] = [];
    rows.push({ label: loc.labelSaleReference ?? "", value: data.saleCode ?? data.saleId });
    if (data.unitNumber) {
        rows.push({ label: loc.labelUnit ?? "", value: data.unitNumber });
    }
    if (data.installmentNumber != null) {
        rows.push({ label: loc.labelInstallmentNumber ?? "", value: `#${data.installmentNumber}` });
    }
    if (data.installmentAmountDisplay?.trim()) {
        rows.push({ label: loc.labelInstallmentAmount ?? "", value: data.installmentAmountDisplay.trim() });
    }
    if (data.installmentDueDateFormatted?.trim()) {
        rows.push({ label: loc.labelDueDate ?? "", value: data.installmentDueDateFormatted.trim() });
    }

    const rowHtml = rows
        .map(
            (r) => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #ededed;color:#666666;font-size:13px;width:40%;vertical-align:top;">${escapeHtml(r.label)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #ededed;font-size:14px;color:#111111;font-weight:600;vertical-align:top;text-align:right;">${escapeHtml(r.value)}</td>
  </tr>`
        )
        .join("");

    const title = loc.installmentDetailsTitle ?? "";
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;border:1px solid #e8e8e8;border-radius:8px;">
  <tr><td style="padding:14px 18px;background:#fafafa;font-size:12px;font-weight:600;color:#374151;">${escapeHtml(title)}</td></tr>
  <tr><td style="padding:8px 18px 14px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rowHtml}</table></td></tr>
  </table>`;
}

export async function sendSaleClientMail(data: SaleClientEmailEvent): Promise<void> {
    if (!canSendEmails()) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || fallbackLanguageCode;
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["saleClient"], languageCode, LOCALES_ROOT);
    let emailTemplate = readTemplateHtml(TEMPLATE_DIR, "saleClient.html");

    const unitNumber = data.unitNumber ?? "—";
    const saleCode = data.saleCode ?? data.saleId;
    const companyName = data.companyName ?? "";
    const loc = strings as Record<string, string>;

    const paymentTypeLabel = data.paymentType === "payment_plan" ? loc.paymentTypePlan ?? "Payment plan" : loc.paymentTypeCash ?? "Cash";

    const contractAttachment =
        data.kind === "sale_created" && data.purchaseContractMediaId
            ? await tryLoadReservationContractForEmail(data.purchaseContractMediaId, languageCode)
            : null;

    let detailsSummary = "";
    if (data.kind === "sale_created") {
        detailsSummary = buildSaleCreatedSummaryHtml(loc, {
            saleCode,
            unitNumber,
            unitDisplayName: data.unitDisplayName,
            unitPriceDisplay: data.unitPriceDisplay,
            finalPriceDisplay: data.finalPriceDisplay,
            paymentTypeLabel,
            downPaymentDisplay: data.downPaymentDisplay,
            numberOfInstallments: data.numberOfInstallments,
        });
    }

    const installmentContext = data.kind !== "sale_created" ? buildInstallmentContextHtml(loc, data) : "";

    let contractNote = "";
    if (contractAttachment && data.kind === "sale_created") {
        const note = loc.contractAttachedNote ?? "";
        contractNote = `<p style="line-height: 175%; margin: 0 0 16px 0; color: #14532d; font-size: 14px; background: #f0fdf4; border-radius: 10px; padding: 14px 18px; border: 1px solid #86efac;">${escapeHtml(
            note
        )}</p>`;
    }

    const greeting = applyPlaceholders(loc.greeting ?? "", {fullName: data.fullName});

    const dueDate = data.installmentDueDateFormatted ?? data.installmentDueDateIso ?? "—";
    const instNum = String(data.installmentNumber ?? "");
    const instAmt = data.installmentAmountDisplay ?? "—";
    const daysRem = String(data.daysRemaining ?? 0);

    const introRemaining = applyPlaceholders(loc.introInstRemainingDays ?? "", {
        daysRemaining: daysRem,
        companyName,
        dueDate,
        installmentNumber: instNum,
    });

    const bodyPlaceholders: Record<string, string> = {
        greeting,
        companyName,
        saleCode,
        unitNumber,
        detailsSummary,
        installmentContext,
        contractNote,
        introSaleCreated: applyPlaceholders(loc.introSaleCreated ?? "", {companyName}),
        closingSaleCreated: loc.closingSaleCreated ?? "",
        dueDate,
        installmentNumber: instNum,
        installmentAmount: instAmt,
        introInstRemainingDays: introRemaining,
        closingInstRemainingDays: loc.closingInstRemainingDays ?? "",
        introInstOverdue: applyPlaceholders(loc.introInstOverdue ?? "", {companyName, dueDate, installmentNumber: instNum}),
        closingInstOverdue: loc.closingInstOverdue ?? "",
        introInst3: applyPlaceholders(loc.introInst3 ?? "", {companyName, dueDate, installmentNumber: instNum}),
        closingInst3: loc.closingInst3 ?? "",
        introInst1: applyPlaceholders(loc.introInst1 ?? "", {companyName, dueDate, installmentNumber: instNum}),
        closingInst1: loc.closingInst1 ?? "",
        introInst0: applyPlaceholders(loc.introInst0 ?? "", {companyName, dueDate, installmentNumber: instNum}),
        closingInst0: loc.closingInst0 ?? "",
    };

    let bodyFile: string;
    let subjectKey: string;
    if (data.kind === "sale_created") {
        bodyFile = "body-sale-created.html";
        subjectKey = "subjectSaleCreated";
    } else if (data.kind === "installment_remaining_days") {
        bodyFile = "body-installment-remaining-days.html";
        subjectKey = "subjectInstRemainingDays";
    } else if (data.kind === "installment_overdue") {
        bodyFile = "body-installment-overdue.html";
        subjectKey = "subjectInstOverdue";
    } else {
        const phase = data.reminderPhase ?? "3";
        bodyFile = phase === "1" ? "body-installment-reminder-1.html" : phase === "0" ? "body-installment-reminder-0.html" : "body-installment-reminder-3.html";
        subjectKey = phase === "1" ? "subjectInstReminder1" : phase === "0" ? "subjectInstReminder0" : "subjectInstReminder3";
    }

    let bodyInner = readTemplateHtml(TEMPLATE_DIR, bodyFile);
    bodyInner = applyPlaceholders(bodyInner, bodyPlaceholders);

    emailTemplate = applyPlaceholders(emailTemplate, {
        heading: strings.heading ?? "",
        imageAlt: strings.imageAlt ?? "",
        copyright: strings.copyright ?? "",
    });

    emailTemplate = applyPlaceholders(emailTemplate, {
        username: data.fullName,
        bodyInner,
        pageName,
    });

    const subjectRaw = (strings as Record<string, string>)[subjectKey] ?? strings.subjectSaleCreated ?? "";
    const subject = applyPlaceholders(subjectRaw, {companyName, pageName, installmentNumber: instNum});

    const attachments: nodemailer.SendMailOptions["attachments"] = [
        {
            filename: "companyTick.png",
            path: imagePath,
            cid: imageCID,
        },
    ];
    if (contractAttachment) {
        attachments.push({
            filename: contractAttachment.filename,
            content: contractAttachment.content,
            contentType: contractAttachment.contentType,
        });
    }

    try {
        await sendMail(data.companyId, {
            to: data.email,
            subject,
            html: emailTemplate,
            attachments,
        });
    } catch {
        throw apiValidationException("could_not_send_email", "sale_client_email", null, languageCode);
    }
}
