import type nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import type {ReservationClientEmailEvent} from "../../kafka/types";
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
const TEMPLATE_DIR = path.join(__dirname, "templates", "reservationClient");

/** Copy suffix per notification kind: `subject{X}`, `heading{X}`, `preheader{X}`. */
type ReservationVariant = "Created" | "Paid" | "Expired" | "RemainingDays" | "Reminder3" | "Reminder1" | "Reminder0";

const BODY_FILES: Record<ReservationVariant, string> = {
    Created: "body-created.html",
    Paid: "body-paid.html",
    Expired: "body-expired.html",
    RemainingDays: "body-remaining-days.html",
    Reminder3: "body-reminder-3.html",
    Reminder1: "body-reminder-1.html",
    Reminder0: "body-reminder-0.html",
};

function canSendEmails(): boolean {
    return EMAIL.ENABLED;
}

function readTemplateHtml(templateDir: string, filename: string): string {
    return fs.readFileSync(path.join(templateDir, filename), "utf8");
}

function resolveVariant(data: ReservationClientEmailEvent): ReservationVariant {
    if (data.kind === "created") {
        return "Created";
    }
    if (data.kind === "paid") {
        return "Paid";
    }
    if (data.kind === "expiration_expired") {
        return "Expired";
    }
    if (data.kind === "remaining_days") {
        return "RemainingDays";
    }
    const phase = data.reminderPhase ?? "3";
    return phase === "1" ? "Reminder1" : phase === "0" ? "Reminder0" : "Reminder3";
}

/**
 * Full summary for the created/paid mails, and a compact reference block for the
 * reminder and expiry mails.
 */
function buildReservationSummaryHtml(
    loc: Record<string, string>,
    variant: ReservationVariant,
    rowData: {
        reservationCode: string;
        unitNumber: string;
        unitDisplayName?: string;
        projectName?: string;
        edificeName?: string;
        floorName?: string;
        unitPriceDisplay?: string;
        reservationDepositDisplay?: string;
        expirationDate?: string;
    }
): string {
    const rows: SummaryRow[] = [
        {label: loc.labelReference ?? "", value: rowData.reservationCode},
    ];
    pushUnitLocationRows(rows, loc, rowData);
    rows.push({label: loc.labelUnit ?? "", value: rowData.unitNumber});
    pushRow(rows, loc.labelUnitName, rowData.unitDisplayName);

    if (variant === "Created" || variant === "Paid") {
        pushRow(rows, loc.labelUnitPrice, rowData.unitPriceDisplay);
        pushRow(rows, loc.labelDeposit, rowData.reservationDepositDisplay);
        pushRow(rows, loc.labelEndDate, rowData.expirationDate);
    }

    return summaryCardHtml(loc.summaryTitle ?? "", rows);
}

export async function sendReservationClientMail(data: ReservationClientEmailEvent): Promise<void> {
    if (!canSendEmails()) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || fallbackLanguageCode;
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["reservationClient"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    let emailTemplate = readTemplateHtml(TEMPLATE_DIR, "reservationClient.html");

    const variant = resolveVariant(data);
    const unitNumber = data.unitNumber ?? "—";
    const reservationCode = data.reservationCode ?? data.reservationId;
    const companyName = data.companyName ?? "";
    const expirationDate = data.expirationDateFormatted ?? data.expirationDateIso ?? "—";

    const hasExpiration =
        !!(data.expirationDateIso || data.expirationDateFormatted) &&
        expirationDate !== "—";

    const greeting = localized(strings, "greeting", {fullName: data.fullName});

    const contractAttachment =
        data.kind === "created" && data.reservationContractMediaId
            ? await tryLoadReservationContractForEmail(data.reservationContractMediaId, languageCode)
            : null;

    const detailsSummary = buildReservationSummaryHtml(loc, variant, {
        reservationCode,
        unitNumber,
        unitDisplayName: data.unitDisplayName,
        projectName: data.projectName,
        edificeName: data.edificeName,
        floorName: data.floorName,
        unitPriceDisplay: data.unitPriceDisplay,
        reservationDepositDisplay: data.reservationDepositDisplay ?? data.depositSummary,
        expirationDate: hasExpiration ? expirationDate : undefined,
    });

    const contractNote = contractAttachment && variant === "Created" ? noteHtml(loc.contractAttachedNote ?? "") : "";

    const bodyPlaceholders: Record<string, string> = {
        companyName,
        reservationCode,
        unitNumber,
        expirationDate,
        introCreated: loc.introCreated ?? "",
        introPaid: loc.introPaid ?? "",
        closingCreated: loc.closingCreated ?? "",
        closingPaid: loc.closingPaid ?? "",
        detailsSummary,
        contractNote,
        introExpired: localized(strings, "introExpired", {companyName, expirationDate}),
        closingExpired: loc.closingExpired ?? "",
        introRemainingDays: localized(strings, "introRemainingDays", {
            daysRemaining: String(data.daysRemaining ?? 0),
            companyName,
            expirationDate,
        }),
        closingRemainingDays: loc.closingRemainingDays ?? "",
        introReminder3a: loc.introReminder3a ?? "",
        introReminder3b: loc.introReminder3b ?? "",
        introReminder3c: loc.introReminder3c ?? "",
        closingReminder3: loc.closingReminder3 ?? "",
        introReminder1a: loc.introReminder1a ?? "",
        introReminder1b: loc.introReminder1b ?? "",
        introReminder1c: loc.introReminder1c ?? "",
        closingReminder1: loc.closingReminder1 ?? "",
        introReminder0a: loc.introReminder0a ?? "",
        introReminder0b: loc.introReminder0b ?? "",
        introReminder0c: loc.introReminder0c ?? "",
        closingReminder0: loc.closingReminder0 ?? "",
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

    const subject = applyPlaceholders(loc[`subject${variant}`] ?? "", {companyName, pageName});

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
        throw apiValidationException("could_not_send_email", "reservation_client_email", null, languageCode);
    }
}
