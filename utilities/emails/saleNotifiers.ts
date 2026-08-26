import type nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import type {SaleClientEmailEvent} from "../../kafka/types";
import {tryLoadReservationContractForEmail} from "./reservationContractAttachment";
import {
    currentYear,
    layoutStrings,
    localized,
    noteHtml,
    pushRow,
    pushUnitLocationRows,
    summaryCardHtml,
    type SummaryRow,
} from "./emailLayout";

const fallbackLanguageCode = "en-US";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "saleClient");

/** Copy suffix per notification kind: `subject{X}`, `heading{X}`, `preheader{X}`. */
type SaleVariant =
    | "SaleCreated"
    | "InstRemainingDays"
    | "InstOverdue"
    | "InstReminder3"
    | "InstReminder1"
    | "InstReminder0";

const BODY_FILES: Record<SaleVariant, string> = {
    SaleCreated: "body-sale-created.html",
    InstRemainingDays: "body-installment-remaining-days.html",
    InstOverdue: "body-installment-overdue.html",
    InstReminder3: "body-installment-reminder-3.html",
    InstReminder1: "body-installment-reminder-1.html",
    InstReminder0: "body-installment-reminder-0.html",
};

function canSendEmails(): boolean {
    return EMAIL.ENABLED;
}

function readTemplateHtml(templateDir: string, filename: string): string {
    return fs.readFileSync(path.join(templateDir, filename), "utf8");
}

function resolveVariant(data: SaleClientEmailEvent): SaleVariant {
    if (data.kind === "sale_created") {
        return "SaleCreated";
    }
    if (data.kind === "installment_remaining_days") {
        return "InstRemainingDays";
    }
    if (data.kind === "installment_overdue") {
        return "InstOverdue";
    }
    const phase = data.reminderPhase ?? "3";
    return phase === "1" ? "InstReminder1" : phase === "0" ? "InstReminder0" : "InstReminder3";
}

function buildSaleCreatedSummaryHtml(
    loc: Record<string, string>,
    rowData: {
        saleCode: string;
        unitNumber: string;
        unitDisplayName?: string;
        projectName?: string;
        edificeName?: string;
        floorName?: string;
        unitPriceDisplay?: string;
        finalPriceDisplay?: string;
        paymentTypeLabel: string;
        downPaymentDisplay?: string;
        numberOfInstallments?: number;
    }
): string {
    const rows: SummaryRow[] = [
        {label: loc.labelSaleReference ?? "", value: rowData.saleCode},
    ];
    pushUnitLocationRows(rows, loc, rowData);
    rows.push({label: loc.labelUnit ?? "", value: rowData.unitNumber});

    pushRow(rows, loc.labelUnitName, rowData.unitDisplayName);
    pushRow(rows, loc.labelUnitPrice, rowData.unitPriceDisplay);
    pushRow(rows, loc.labelFinalPrice, rowData.finalPriceDisplay);
    rows.push({label: loc.labelPaymentType ?? "", value: rowData.paymentTypeLabel});
    pushRow(rows, loc.labelDownPayment, rowData.downPaymentDisplay);
    if (rowData.numberOfInstallments != null && rowData.numberOfInstallments > 0) {
        rows.push({label: loc.labelInstallmentCount ?? "", value: String(rowData.numberOfInstallments)});
    }

    return summaryCardHtml(loc.summaryTitle ?? "", rows);
}

function buildInstallmentContextHtml(loc: Record<string, string>, data: SaleClientEmailEvent): string {
    const rows: SummaryRow[] = [{label: loc.labelSaleReference ?? "", value: data.saleCode ?? data.saleId}];
    pushUnitLocationRows(rows, loc, data);
    pushRow(rows, loc.labelUnit, data.unitNumber);
    if (data.installmentNumber != null) {
        rows.push({label: loc.labelInstallmentNumber ?? "", value: `#${data.installmentNumber}`});
    }
    pushRow(rows, loc.labelInstallmentAmount, data.installmentAmountDisplay);
    pushRow(rows, loc.labelDueDate, data.installmentDueDateFormatted);

    return summaryCardHtml(loc.installmentDetailsTitle ?? "", rows);
}

export async function sendSaleClientMail(data: SaleClientEmailEvent): Promise<void> {
    if (!canSendEmails()) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || fallbackLanguageCode;
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["saleClient"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    let emailTemplate = readTemplateHtml(TEMPLATE_DIR, "saleClient.html");

    const variant = resolveVariant(data);
    const unitNumber = data.unitNumber ?? "—";
    const saleCode = data.saleCode ?? data.saleId;
    const companyName = data.companyName ?? "";

    const paymentTypeLabel =
        data.paymentType === "payment_plan" ? loc.paymentTypePlan ?? "Payment plan" : loc.paymentTypeCash ?? "Cash";

    const contractAttachment =
        variant === "SaleCreated" && data.purchaseContractMediaId
            ? await tryLoadReservationContractForEmail(data.purchaseContractMediaId, languageCode)
            : null;

    const detailsSummary =
        variant === "SaleCreated"
            ? buildSaleCreatedSummaryHtml(loc, {
                  saleCode,
                  unitNumber,
                  unitDisplayName: data.unitDisplayName,
                  projectName: data.projectName,
                  edificeName: data.edificeName,
                  floorName: data.floorName,
                  unitPriceDisplay: data.unitPriceDisplay,
                  finalPriceDisplay: data.finalPriceDisplay,
                  paymentTypeLabel,
                  downPaymentDisplay: data.downPaymentDisplay,
                  numberOfInstallments: data.numberOfInstallments,
              })
            : "";

    const installmentContext = variant === "SaleCreated" ? "" : buildInstallmentContextHtml(loc, data);

    const contractNote = contractAttachment && variant === "SaleCreated" ? noteHtml(loc.contractAttachedNote ?? "") : "";

    const greeting = localized(strings, "greeting", {fullName: data.fullName});

    const dueDate = data.installmentDueDateFormatted ?? data.installmentDueDateIso ?? "—";
    const instNum = String(data.installmentNumber ?? "");
    const instAmt = data.installmentAmountDisplay ?? "—";
    const daysRem = String(data.daysRemaining ?? 0);

    const bodyPlaceholders: Record<string, string> = {
        companyName,
        saleCode,
        unitNumber,
        detailsSummary,
        installmentContext,
        contractNote,
        introSaleCreated: localized(strings, "introSaleCreated", {companyName}),
        closingSaleCreated: loc.closingSaleCreated ?? "",
        dueDate,
        installmentNumber: instNum,
        installmentAmount: instAmt,
        introInstRemainingDays: localized(strings, "introInstRemainingDays", {
            daysRemaining: daysRem,
            companyName,
            dueDate,
            installmentNumber: instNum,
        }),
        closingInstRemainingDays: loc.closingInstRemainingDays ?? "",
        introInstOverdue: localized(strings, "introInstOverdue", {companyName, dueDate, installmentNumber: instNum}),
        closingInstOverdue: loc.closingInstOverdue ?? "",
        introInst3: localized(strings, "introInst3", {companyName, dueDate, installmentNumber: instNum}),
        closingInst3: loc.closingInst3 ?? "",
        introInst1: localized(strings, "introInst1", {companyName, dueDate, installmentNumber: instNum}),
        closingInst1: loc.closingInst1 ?? "",
        introInst0: localized(strings, "introInst0", {companyName, dueDate, installmentNumber: instNum}),
        closingInst0: loc.closingInst0 ?? "",
    };

    let bodyInner = readTemplateHtml(TEMPLATE_DIR, BODY_FILES[variant]);
    bodyInner = applyPlaceholders(bodyInner, bodyPlaceholders);

    emailTemplate = applyPlaceholders(
        emailTemplate,
        layoutStrings(strings, `heading${variant}`, `preheader${variant}`)
    );

    const values = {
        greeting,
        bodyInner,
        companyName,
        pageName,
        year: currentYear(),
    };
    emailTemplate = applyPlaceholders(emailTemplate, values);

    const subject = applyPlaceholders(loc[`subject${variant}`] ?? "", {
        companyName,
        pageName,
        installmentNumber: instNum,
    });

    const attachments: nodemailer.SendMailOptions["attachments"] = [];
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
