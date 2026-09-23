/**
 * The three shipped ad-campaign email templates — one per campaign type.
 *
 * Hand-authored, not exported from a live database: these are the defaults a
 * fresh company starts with, so an operator can send a campaign on day one
 * instead of facing an empty template library and a blank HTML editor.
 *
 * All three are `en-US` and `isDefault`. The sender resolves a recipient's
 * locale through `adCampaignTemplateService.resolveForLocale`, which falls back
 * to the chosen row when no sibling exists in that language — so one locale is
 * a working default for every recipient, and a company adds translated siblings
 * (same `name`, same `campaignType`, different `locale`) when it wants them.
 *
 * Body constraints, all enforced elsewhere and worth keeping in mind when editing:
 *  - only tokens from `AD_CAMPAIGN_PLACEHOLDERS`; the validator rejects the rest,
 *    and a typo'd `{frstName}` ships verbatim to every recipient;
 *  - table-based layout with inline styles — this is email, not a web page;
 *  - must survive `sanitizeAdCampaignHtml` unchanged (there is a test for it);
 *  - no unsubscribe link needed: the shell always emits the footer.
 */
import type {AdCampaignTemplateSeedRow} from "./types";

/** Shared call-to-action button. `{ctaUrl}` is substituted per recipient. */
const cta = (label: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 0">` +
    `<tr><td bgcolor="#111114" style="background-color:#111114;border-radius:8px">` +
    `<a href="{ctaUrl}" style="display:inline-block;padding:13px 28px;font-family:'Montserrat',Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${label}</a>` +
    `</td></tr></table>`;

/** One label/value line of a summary table. */
const row = (label: string, value: string, emphasis = false) =>
    `<tr>` +
    `<td style="padding:10px 0;border-bottom:1px solid #eceef1;color:#8a9099;font-size:13px">${label}</td>` +
    `<td align="right" style="padding:10px 0;border-bottom:1px solid #eceef1;font-size:${emphasis ? "15px;font-weight:600;color:#111114" : "14px"}">${value}</td>` +
    `</tr>`;

const PRICE_CHANGE_BODY =
    `<p style="margin:0 0 14px">We wanted you to hear this from us first: the price of ` +
    `<strong>{unitNumber}</strong> at {projectName} has changed.</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;border-collapse:collapse">` +
    row("Previous price", "<s>{oldPrice}</s>") +
    row("New price", "{newPrice}", true) +
    row("Change", "{priceChangePercent}") +
    `</table>` +
    `<p style="margin:18px 0 0;color:#8a9099;font-size:13px">Prices are subject to availability at the time of reservation.</p>` +
    cta("View the unit");

const OFFER_BODY =
    `<h2 style="margin:0 0 12px;font-size:19px;font-weight:600;color:#111114">{offerTitle}</h2>` +
    `<p style="margin:0 0 14px">For a limited period we are covering notary and registration fees ` +
    `on remaining units at {projectName}.</p>` +
    `<ul style="margin:16px 0 0;padding-left:20px">` +
    `<li style="margin:0 0 6px">Notary and registration fees covered</li>` +
    `<li style="margin:0 0 6px">Flexible payment plan over 24 months</li>` +
    `<li style="margin:0 0 6px">Parking space included</li>` +
    `</ul>` +
    `<p style="margin:18px 0 0;color:#8a9099;font-size:13px">Offer valid until {offerEndsAt}.</p>` +
    cta("See the offer");

const NEW_PROJECT_BODY =
    `<p style="margin:0 0 14px">We are pleased to introduce <strong>{projectName}</strong>, ` +
    `the newest development from {companyName}.</p>` +
    `<p style="margin:0 0 14px">Clients hear about new releases before they are listed publicly, ` +
    `which is why this is reaching you first.</p>` +
    `<p style="margin:18px 0 0;color:#8a9099;font-size:13px">Floor plans and availability are ` +
    `on the project page.</p>` +
    cta("Explore the project");

export const adCampaignTemplatesSeed: readonly AdCampaignTemplateSeedRow[] = [
    {
        id: "6a9c1f0100000000ad000001",
        name: "Price update",
        campaignType: "price_change",
        locale: "en-US",
        subject: "A price update on {unitNumber} at {projectName}",
        previewText: "{unitNumber} is now {newPrice}.",
        bodyHtml: PRICE_CHANGE_BODY,
        isDefault: true,
        active: true,
    },
    {
        id: "6a9c1f0100000000ad000002",
        name: "Seasonal offer",
        campaignType: "offer",
        locale: "en-US",
        subject: "{offerTitle} — until {offerEndsAt}",
        previewText: "An offer for clients of {companyName}.",
        bodyHtml: OFFER_BODY,
        isDefault: true,
        active: true,
    },
    {
        id: "6a9c1f0100000000ad000003",
        name: "New project announcement",
        campaignType: "new_project",
        locale: "en-US",
        subject: "Introducing {projectName}",
        previewText: "A new development from {companyName}.",
        bodyHtml: NEW_PROJECT_BODY,
        isDefault: true,
        active: true,
    },
];
