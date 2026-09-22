import * as fs from "fs";
import * as path from "path";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import {currentYear, escapeHtml, layoutStrings, localized, pushRow, summaryCardHtml, type SummaryRow} from "./emailLayout";
import type {InlineImageAttachment} from "./mediaImageAttachments";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "constructionProgressClient");
const FONT = "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif";

export type ConstructionProgressClientEmail = {
    email: string;
    fullName: string;
    languageCode: string;
    companyId: string;
    companyName: string;
    projectName: string;
    edificeName?: string;
    /** Unit labels this client holds in scope (e.g. "A-101"). */
    unitLabels: string[];
    phase: string;
    progressPercent: number;
    updateDateFormatted?: string;
    expectedCompletionFormatted?: string;
    title?: string;
    description?: string;
    /** Already loaded + size-bounded; embedded inline by cid. */
    photos: InlineImageAttachment[];
};

function clampPercent(n: number): number {
    return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}

/** Two-cell table bar: renders in every mail client (no CSS width animations / divs). */
export function progressBarHtml(percent: number, label: string): string {
    const p = clampPercent(percent);
    const filled = p > 0 ? `<td width="${p}%" bgcolor="#cca250" style="background-color:#cca250;height:10px;font-size:0;line-height:0;${p === 100 ? "border-radius:6px;" : "border-radius:6px 0 0 6px;"}">&nbsp;</td>` : "";
    const empty = p < 100 ? `<td bgcolor="#eceef1" style="background-color:#eceef1;height:10px;font-size:0;line-height:0;${p === 0 ? "border-radius:6px;" : "border-radius:0 6px 6px 0;"}">&nbsp;</td>` : "";
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr><td style="padding:22px 0 6px;font-family:${FONT};font-size:13px;font-weight:600;color:#111114;">${escapeHtml(label)}</td></tr>
  <tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>${filled}${empty}</tr></table></td></tr>
</table>`;
}

function descriptionHtml(title: string | undefined, description: string | undefined, heading: string): string {
    const body = [title, description].filter((t): t is string => !!t?.trim());
    if (!body.length) return "";
    const paragraphs = body
        .map((t, i) => `<p style="margin:${i === 0 ? "0" : "8px 0 0"};font-family:${FONT};font-size:14px;font-weight:${i === 0 && title ? 600 : 400};line-height:170%;color:#4b5058;white-space:pre-line;">${escapeHtml(t)}</p>`)
        .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr><td style="padding:24px 0 8px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9aa0a8;">${escapeHtml(heading)}</td></tr>
  <tr><td>${paragraphs}</td></tr>
</table>`;
}

/** Photos stacked full-width (reliable across clients and phones), referenced by cid. */
function photoGalleryHtml(photos: InlineImageAttachment[], heading: string): string {
    if (!photos.length) return "";
    const imgs = photos
        .map(p => `<tr><td style="padding:0 0 12px;"><img src="cid:${escapeHtml(p.cid)}" alt="${escapeHtml(p.filename)}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:10px;"></td></tr>`)
        .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr><td style="padding:24px 0 10px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9aa0a8;">${escapeHtml(heading)}</td></tr>
  ${imgs}
</table>`;
}

export async function sendConstructionProgressClientMail(data: ConstructionProgressClientEmail): Promise<void> {
    if (!EMAIL.ENABLED) {
        return;
    }

    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US";
    const strings = loadEmailStrings(["constructionProgressClient"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    const percent = String(clampPercent(data.progressPercent));
    const phase = loc[`phase_${data.phase}`] ?? data.phase;
    const unitList = data.unitLabels.join(", ");

    // Plain values for the subject; HTML-escaped values for the body.
    const plain = {companyName: data.companyName, project: data.projectName, unitList, percent, phase};
    const safe = {
        companyName: escapeHtml(data.companyName),
        project: escapeHtml(data.projectName),
        unitList: escapeHtml(unitList),
        percent,
        phase: escapeHtml(phase),
    };

    const rows: SummaryRow[] = [];
    pushRow(rows, loc.labelProject, data.projectName);
    pushRow(rows, loc.labelEdifice, data.edificeName);
    pushRow(rows, loc.labelUnits, unitList);
    pushRow(rows, loc.labelPhase, phase);
    pushRow(rows, loc.labelPercent, `${percent}%`);
    pushRow(rows, loc.labelUpdateDate, data.updateDateFormatted);
    pushRow(rows, loc.labelExpectedCompletion, data.expectedCompletionFormatted);

    let bodyInner = fs.readFileSync(path.join(TEMPLATE_DIR, "body-progress.html"), "utf8");
    bodyInner = applyPlaceholders(bodyInner, {
        intro: localized(strings, "intro", safe),
        progressBar: progressBarHtml(data.progressPercent, localized(strings, "progressBarLabel", plain)),
        detailsSummary: summaryCardHtml(loc.summaryTitle ?? "", rows),
        descriptionBlock: descriptionHtml(data.title, data.description, loc.descriptionTitle ?? ""),
        photoGallery: photoGalleryHtml(data.photos, loc.photosTitle ?? ""),
        closing: escapeHtml(loc.closing ?? ""),
    });

    let emailTemplate = fs.readFileSync(path.join(TEMPLATE_DIR, "constructionProgressClient.html"), "utf8");
    const layout = layoutStrings(strings, "heading", "preheader");
    emailTemplate = applyPlaceholders(emailTemplate, {
        ...layout,
        heading: applyPlaceholders(layout.heading, safe),
        preheader: applyPlaceholders(layout.preheader, safe),
    });
    emailTemplate = applyPlaceholders(emailTemplate, {
        greeting: localized(strings, "greeting", {fullName: escapeHtml(data.fullName)}),
        bodyInner,
        companyName: safe.companyName,
        pageName: CLIENT_SIDE.NAME ?? "",
        year: currentYear(),
    });

    await sendMail(data.companyId, {
        to: data.email,
        subject: applyPlaceholders(loc.subject ?? "", plain),
        html: emailTemplate,
        attachments: data.photos.map(p => ({filename: p.filename, content: p.content, contentType: p.contentType, cid: p.cid})),
    });
}
