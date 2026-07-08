import type nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import type {ReservationClientEmailEvent} from "../../kafka/types";
import {tryLoadReservationContractForEmail} from "./reservationContractAttachment";

const imagePath = path.join(__dirname, "./static/images/image-1.png");
const imageCID = "imageCID@example.com";
const fallbackLanguageCode = "en-US";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "reservationClient");

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

function buildReservationDetailsSummaryHtml(
    loc: Record<string, string>,
    rowData: {
        reservationCode: string;
        unitNumber: string;
        unitDisplayName?: string;
        unitPriceDisplay?: string;
        reservationDepositDisplay?: string;
    }
): string {
    const rows: { label: string; value: string }[] = [];
    rows.push({ label: loc.labelReference ?? "Reference:", value: rowData.reservationCode });
    rows.push({ label: loc.labelUnit ?? "Unit:", value: rowData.unitNumber });
    if (rowData.unitDisplayName?.trim()) {
        rows.push({ label: loc.labelUnitName ?? "", value: rowData.unitDisplayName.trim() });
    }
    if (rowData.unitPriceDisplay?.trim()) {
        rows.push({ label: loc.labelUnitPrice ?? "", value: rowData.unitPriceDisplay.trim() });
    }
    if (rowData.reservationDepositDisplay?.trim()) {
        rows.push({ label: loc.labelDeposit ?? "", value: rowData.reservationDepositDisplay.trim() });
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

export async function sendReservationClientMail(data: ReservationClientEmailEvent): Promise<void> {
    if (!canSendEmails()) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || fallbackLanguageCode;
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["reservationClient"], languageCode, LOCALES_ROOT);
    let emailTemplate = readTemplateHtml(TEMPLATE_DIR, "reservationClient.html");

    const unitNumber = data.unitNumber ?? "—";
    const reservationCode = data.reservationCode ?? data.reservationId;
    const companyName = data.companyName ?? "";
    const expirationDate = data.expirationDateFormatted ?? data.expirationDateIso ?? "—";

    const hasExpiration =
        !!(data.expirationDateIso || data.expirationDateFormatted) &&
        expirationDate !== "—";

    const expirationParagraph =
        data.kind === "created" && hasExpiration
            ? applyPlaceholders(strings.expirationLinePattern ?? "", {expirationDate})
            : "";

    const greeting = applyPlaceholders(strings.greeting ?? "", {fullName: data.fullName});

    const loc = strings as Record<string, string>;

    const contractAttachment =
        data.kind === "created" && data.reservationContractMediaId
            ? await tryLoadReservationContractForEmail(data.reservationContractMediaId, languageCode)
            : null;

    let detailsSummary = "";
    if (data.kind === "created" || data.kind === "paid") {
        detailsSummary = buildReservationDetailsSummaryHtml(loc, {
            reservationCode,
            unitNumber,
            unitDisplayName: data.unitDisplayName,
            unitPriceDisplay: data.unitPriceDisplay,
            reservationDepositDisplay: data.reservationDepositDisplay ?? data.depositSummary,
        });
    }

    let contractNote = "";
    if (contractAttachment && data.kind === "created") {
        const note = loc.contractAttachedNote ?? "";
        contractNote = `<p style="line-height: 175%; margin: 0 0 16px 0; color: #14532d; font-size: 14px; background: #f0fdf4; border-radius: 10px; padding: 14px 18px; border: 1px solid #86efac;">${escapeHtml(
            note
        )}</p>`;
    }

    const introExpiredHtml = applyPlaceholders(loc.introExpired ?? "", {companyName, expirationDate});
    const introRemainingDaysHtml = applyPlaceholders(loc.introRemainingDays ?? "", {
        daysRemaining: String(data.daysRemaining ?? 0),
        companyName,
        expirationDate,
    });

    const bodyPlaceholders: Record<string, string> = {
        greeting,
        companyName,
        reservationCode,
        unitNumber,
        expirationDate,
        introCreated: loc.introCreated ?? "",
        introPaid: loc.introPaid ?? "",
        closingCreated: loc.closingCreated ?? "",
        closingPaid: loc.closingPaid ?? "",
        labelReference: loc.labelReference ?? "",
        labelUnit: loc.labelUnit ?? "",
        expirationParagraph,
        detailsSummary,
        contractNote,
        introExpired: introExpiredHtml,
        closingExpired: loc.closingExpired ?? "",
        introRemainingDays: introRemainingDaysHtml,
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

    let bodyFile: string;
    let subjectKey: string;
    if (data.kind === "created") {
        bodyFile = "body-created.html";
        subjectKey = "subjectCreated";
    } else if (data.kind === "paid") {
        bodyFile = "body-paid.html";
        subjectKey = "subjectPaid";
    } else if (data.kind === "expiration_expired") {
        bodyFile = "body-expired.html";
        subjectKey = "subjectExpired";
    } else if (data.kind === "remaining_days") {
        bodyFile = "body-remaining-days.html";
        subjectKey = "subjectRemainingDays";
    } else {
        const phase = data.reminderPhase ?? "3";
        bodyFile = phase === "1" ? "body-reminder-1.html" : phase === "0" ? "body-reminder-0.html" : "body-reminder-3.html";
        subjectKey = phase === "1" ? "subjectReminder1" : phase === "0" ? "subjectReminder0" : "subjectReminder3";
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

    const subjectRaw = (strings as Record<string, string>)[subjectKey] ?? strings.subjectCreated ?? "";
    const subject = applyPlaceholders(subjectRaw, {companyName, pageName});

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
        throw apiValidationException("could_not_send_email", "reservation_client_email", null, languageCode);
    }
}
