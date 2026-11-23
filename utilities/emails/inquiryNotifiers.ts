import * as fs from "fs";
import * as path from "path";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import {currentYear, escapeHtml, layoutStrings, localized, pushRow, summaryCardHtml, type SummaryRow} from "@coreModule/utilities/emails/emailLayout";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "inquiryClient");

export type InquiryClientEmail = {
    email: string;
    fullName: string;
    languageCode: string;
    companyId: string;
    companyName: string;
    /** The project and unit the inquiry is about; neither for a general message (a site's "Get in touch"). */
    projectName?: string;
    unitNumber?: string;
    unitName?: string;
    /** The person's account on the portal apex (D178). */
    accountUrl: string;
};

function readTemplate(filename: string): string {
    return fs.readFileSync(path.join(TEMPLATE_DIR, filename), "utf8");
}

/**
 * Confirms a property inquiry to the person who sent it from a company's site (D178): the company has it and will
 * contact them. Sent over the company's SMTP; does nothing when email is off. The form is public and anyone can type
 * any address into it, so the email never repeats the visitor's message.
 */
export async function sendInquiryClientMail(data: InquiryClientEmail): Promise<void> {
    if (!EMAIL.ENABLED) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US";
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["inquiryClient"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    const safeCompany = {companyName: escapeHtml(data.companyName)};

    const rows: SummaryRow[] = [];
    pushRow(rows, loc.labelProject, data.projectName);
    pushRow(rows, loc.labelUnit, data.unitNumber);
    pushRow(rows, loc.labelUnitName, data.unitName);
    const aboutProperty = Boolean(data.projectName || data.unitNumber);

    const bodyInner = applyPlaceholders(readTemplate("body.html"), {
        intro: localized(strings, aboutProperty ? "introAbout" : "introGeneral", safeCompany),
        detailsSummary: summaryCardHtml(loc.summaryTitle ?? "", rows),
        closing: localized(strings, "closing", safeCompany),
        accountNote: loc.accountNote ?? "",
        accountUrl: escapeHtml(data.accountUrl),
        accountLinkText: localized(strings, "accountLinkText", {pageName}),
    });

    const layout = layoutStrings(strings, "heading", "preheader");
    let html = applyPlaceholders(readTemplate("inquiryClient.html"), {...layout, preheader: applyPlaceholders(layout.preheader, safeCompany)});
    html = applyPlaceholders(html, {
        greeting: localized(strings, "greeting", {fullName: escapeHtml(data.fullName)}),
        bodyInner,
        companyName: safeCompany.companyName,
        pageName,
        year: currentYear(),
    });

    await sendMail(data.companyId, {
        to: data.email,
        subject: localized(strings, "subject", {companyName: data.companyName}),
        html,
    });
}
