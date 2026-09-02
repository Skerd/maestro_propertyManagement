import type nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import type {LeaseClientEmailEvent} from "../../kafka/types";
import {
    currentYear,
    layoutStrings,
    localized,
    pushRow,
    pushUnitLocationRows,
    summaryCardHtml,
    type SummaryRow,
} from "./emailLayout";

const fallbackLanguageCode = "en-US";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "leaseClient");

type LeaseVariant = "RentReminder3" | "RentReminder1" | "RentReminder0" | "RentOverdue";

const BODY_FILES: Record<LeaseVariant, string> = {
    RentReminder3: "body-rent-reminder-3.html",
    RentReminder1: "body-rent-reminder-1.html",
    RentReminder0: "body-rent-reminder-0.html",
    RentOverdue: "body-rent-overdue.html",
};

function canSendEmails(): boolean {
    return EMAIL.ENABLED;
}

function readTemplateHtml(templateDir: string, filename: string): string {
    return fs.readFileSync(path.join(templateDir, filename), "utf8");
}

function resolveVariant(data: LeaseClientEmailEvent): LeaseVariant {
    if (data.kind === "rent_overdue") {
        return "RentOverdue";
    }
    const phase = data.reminderPhase ?? "3";
    return phase === "1" ? "RentReminder1" : phase === "0" ? "RentReminder0" : "RentReminder3";
}

function buildRentContextHtml(loc: Record<string, string>, data: LeaseClientEmailEvent): string {
    const rows: SummaryRow[] = [{label: loc.labelLeaseReference ?? "", value: data.leaseCode ?? data.leaseId}];
    pushUnitLocationRows(rows, loc, data);
    pushRow(rows, loc.labelUnit, data.unitNumber);
    pushRow(rows, loc.labelAmountDue, data.rentRemainingDisplay);
    pushRow(rows, loc.labelDueDate, data.dueDateFormatted);

    return summaryCardHtml(loc.rentDetailsTitle ?? "", rows);
}

export async function sendLeaseClientMail(data: LeaseClientEmailEvent): Promise<void> {
    if (!canSendEmails()) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || fallbackLanguageCode;
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["leaseClient"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    let emailTemplate = readTemplateHtml(TEMPLATE_DIR, "leaseClient.html");

    const variant = resolveVariant(data);
    const companyName = data.companyName ?? "";
    const dueDate = data.dueDateFormatted ?? data.dueDateIso ?? "—";
    const rentRemaining = data.rentRemainingDisplay ?? "—";

    const rentContext = buildRentContextHtml(loc, data);
    const greeting = localized(strings, "greeting", {fullName: data.fullName});

    const bodyPlaceholders: Record<string, string> = {
        companyName,
        rentContext,
        dueDate,
        rentRemaining,
        introRent3: localized(strings, "introRent3", {companyName, dueDate, rentRemaining}),
        closingRent3: loc.closingRent3 ?? "",
        introRent1: localized(strings, "introRent1", {companyName, dueDate, rentRemaining}),
        closingRent1: loc.closingRent1 ?? "",
        introRent0: localized(strings, "introRent0", {companyName, dueDate, rentRemaining}),
        closingRent0: loc.closingRent0 ?? "",
        introRentOverdue: localized(strings, "introRentOverdue", {companyName, dueDate, rentRemaining}),
        closingRentOverdue: loc.closingRentOverdue ?? "",
    };

    let bodyInner = readTemplateHtml(TEMPLATE_DIR, BODY_FILES[variant]);
    bodyInner = applyPlaceholders(bodyInner, bodyPlaceholders);

    emailTemplate = applyPlaceholders(
        emailTemplate,
        layoutStrings(strings, `heading${variant}`, `preheader${variant}`),
    );

    emailTemplate = applyPlaceholders(emailTemplate, {
        greeting,
        bodyInner,
        companyName,
        pageName,
        year: currentYear(),
    });

    const subject = applyPlaceholders(loc[`subject${variant}`] ?? "", {
        companyName,
        pageName,
    });

    const attachments: nodemailer.SendMailOptions["attachments"] = [];

    try {
        await sendMail(data.companyId, {
            to: data.email,
            subject,
            html: emailTemplate,
            attachments,
        });
    } catch {
        throw apiValidationException("could_not_send_email", "lease_client_email", null, languageCode);
    }
}
