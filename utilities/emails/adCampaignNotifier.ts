import * as fs from "fs";
import * as path from "path";
import {CLIENT_SIDE, CONSTANTS, EMAIL} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings, resolveEmailLocaleTag} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";
import {
    AD_CAMPAIGN_PLACEHOLDER_PATTERN,
    type AdCampaignPlaceholder,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {currentYear, escapeHtml, localized} from "./emailLayout";
import {sanitizeAdCampaignHtml} from "./adCampaignHtmlSanitizer";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "adCampaign");
const FONT = "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif";

/** Values for the `{tokens}` an author may use. Anything omitted renders empty. */
export type AdCampaignTokenValues = Partial<Record<AdCampaignPlaceholder, string>>;

export type RenderAdCampaignInput = {
    /** Author-supplied markup: the campaign's override, else the template body. */
    bodyHtml: string;
    /** Author-supplied subject line, may contain tokens. */
    subject: string;
    /** Inbox preview text, may contain tokens. */
    previewText?: string;
    languageCode: string;
    companyName: string;
    /** Display name for the greeting. */
    fullName: string;
    tokens: AdCampaignTokenValues;
    /** One-click opt-out of this campaign's type. Always rendered in the footer. */
    unsubscribeUrl: string;
    /** The manage-all-preferences page. */
    preferencesUrl: string;
};

export type RenderedAdCampaignEmail = {
    /** The complete email document, shell included. */
    html: string;
    subject: string;
    /** Known tokens the body used that had no value — surfaced in the panel preview. */
    unresolvedPlaceholders: string[];
};

/**
 * The unsubscribe footer.
 *
 * Built into the shell rather than the editable body on purpose: "every
 * campaign email carries an unsubscribe link" has to be a structural guarantee,
 * not a convention an author can forget or delete. The `{unsubscribeUrl}` token
 * exists as well so an author *may* place a second link in the body, but
 * nothing depends on them doing so.
 */
function unsubscribeFooterHtml(
    loc: Record<string, string>,
    unsubscribeUrl: string,
    preferencesUrl: string,
): string {
    const intro = escapeHtml(loc.unsubscribeIntro ?? "");
    const unsub = escapeHtml(loc.unsubscribeLabel ?? "Unsubscribe");
    const manage = escapeHtml(loc.managePreferencesLabel ?? "Manage preferences");
    const sep = escapeHtml(loc.unsubscribeSeparator ?? "·");
    const linkStyle = "color:#9aa0a8;text-decoration:underline;";

    return `<p style="margin:10px 0 0;font-family:${FONT};font-size:12px;font-weight:400;line-height:175%;color:#9aa0a8;text-align:center;">${intro}
  <a href="${escapeHtml(unsubscribeUrl)}" style="${linkStyle}">${unsub}</a>
  ${sep}
  <a href="${escapeHtml(preferencesUrl)}" style="${linkStyle}">${manage}</a>
</p>`;
}

/** Known `{tokens}` still present after substitution. */
function findUnresolved(text: string): string[] {
    const out: string[] = [];
    for (const match of text.matchAll(AD_CAMPAIGN_PLACEHOLDER_PATTERN)) {
        if (!out.includes(match[1])) out.push(match[1]);
    }
    return out;
}

/**
 * Render one campaign email.
 *
 * Pure: no database, no transport. The panel's live preview calls this too, so
 * what an author sees is byte-identical to what ships, and sanitization stays
 * on a single code path.
 *
 * Token values are HTML-escaped for the body but left raw for the subject —
 * the same `plain`/`safe` split the other property-management notifiers use.
 * Getting this backwards would either double-escape the subject or open an
 * injection hole in the body.
 */
export function renderAdCampaignEmail(input: RenderAdCampaignInput): RenderedAdCampaignEmail {
    const languageCode = input.languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US";
    const strings = loadEmailStrings(["adCampaign"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;

    const plain: Record<string, string> = {
        year: currentYear(),
        companyName: input.companyName,
        fullName: input.fullName,
        unsubscribeUrl: input.unsubscribeUrl,
        preferencesUrl: input.preferencesUrl,
    };
    for (const [key, value] of Object.entries(input.tokens)) {
        if (typeof value === "string") plain[key] = value;
    }

    const safe: Record<string, string> = {};
    for (const [key, value] of Object.entries(plain)) {
        // URLs are attribute values, not text — escaping them here keeps a
        // quote in a token value from breaking out of an `href`.
        safe[key] = escapeHtml(value);
    }

    // 1. Author markup → tokens substituted → sanitized.
    //
    // Sanitizing *after* substitution matters: a token value is escaped before
    // it lands, so it cannot inject markup, and sanitizing last also catches
    // anything unsafe that predates this module in a stored row.
    const substitutedBody = applyPlaceholders(input.bodyHtml ?? "", safe);
    const campaignBody = sanitizeAdCampaignHtml(substitutedBody);

    let bodyInner = fs.readFileSync(path.join(TEMPLATE_DIR, "body-campaign.html"), "utf8");
    bodyInner = applyPlaceholders(bodyInner, {campaignBody});

    // 2. Subject and preheader use the raw values — a mail client renders them
    //    as text, so `&amp;` would show up literally.
    const subject = applyPlaceholders(input.subject ?? "", plain).trim();
    const preheader = applyPlaceholders(input.previewText ?? "", plain).trim();

    // 3. Shell. `heading` mirrors the subject so the headline and the inbox
    //    line stay consistent; authors who don't want it repeated simply leave
    //    it out of their body.
    //
    // The layout map is built directly rather than through `layoutStrings`:
    // that helper selects heading/preheader copy from the locale file, but for
    // a campaign both come from the author's template in the database.
    let html = fs.readFileSync(path.join(TEMPLATE_DIR, "adCampaign.html"), "utf8");
    html = applyPlaceholders(html, {
        htmlLang: loc.htmlLang ?? "en",
        ignore: escapeHtml(loc.ignore ?? ""),
        heading: escapeHtml(subject),
        preheader: escapeHtml(preheader),
        greeting: localized(strings, "greeting", {fullName: safe.fullName}),
        footerNote: applyPlaceholders(loc.footerNote ?? "", safe),
        copyright: applyPlaceholders(loc.copyright ?? "", {
            year: safe.year,
            pageName: escapeHtml(CLIENT_SIDE.NAME ?? ""),
        }),
        unsubscribeFooter: unsubscribeFooterHtml(loc, input.unsubscribeUrl, input.preferencesUrl),
        bodyInner,
        companyName: safe.companyName,
        pageName: escapeHtml(CLIENT_SIDE.NAME ?? ""),
        year: safe.year,
    });

    return {
        html,
        subject,
        unresolvedPlaceholders: findUnresolved(`${campaignBody} ${subject} ${preheader}`),
    };
}

export type SendAdCampaignInput = RenderAdCampaignInput & {
    email: string;
    companyId: string;
    fromName?: string;
    replyTo?: string;
    /** RFC 8058 POST endpoint; empty disables the one-click header. */
    oneClickUrl?: string;
    /**
     * Injected by the batch sender so one pooled SMTP connection serves a whole
     * campaign. Falls back to the per-message `sendMail` when absent.
     */
    send?: (opts: Record<string, any>) => Promise<{messageId?: string}>;
};

/**
 * Render and deliver one campaign email.
 *
 * Returns the provider's message id when the transport reports one, so the
 * recipient row can record exactly what was sent.
 */
export async function sendAdCampaignMail(input: SendAdCampaignInput): Promise<{messageId?: string}> {
    if (!EMAIL.ENABLED) {
        return {};
    }

    const rendered = renderAdCampaignEmail(input);

    const mailOptions: Record<string, any> = {
        to: input.email,
        subject: rendered.subject,
        html: rendered.html,
        ...(input.fromName ? {fromName: input.fromName} : {}),
        ...(input.replyTo ? {replyTo: input.replyTo} : {}),
        // RFC 8058. Gmail's and Yahoo's bulk-sender rules require these, and
        // they are a large part of the difference between the inbox and the
        // spam folder. `MailDeliverySendOptions` extends nodemailer's own
        // options, so `headers` passes straight through untouched.
        //
        // `List-Unsubscribe-Post` is only advertised when there is a real
        // POST-able endpoint to advertise: promising one-click and then serving
        // a GET-only page breaks the contract with the providers that check.
        headers: input.oneClickUrl
            ? {
                  "List-Unsubscribe": `<${input.oneClickUrl}>, <${input.unsubscribeUrl}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : {
                  "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
              },
    };

    if (input.send) {
        return input.send(mailOptions);
    }

    await sendMail(input.companyId, mailOptions as any);
    return {};
}

/** Recipient locale, narrowed to a locale the email templates actually have. */
export function resolveRecipientLocale(languageCode: string | undefined): string {
    return resolveEmailLocaleTag(languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US");
}
