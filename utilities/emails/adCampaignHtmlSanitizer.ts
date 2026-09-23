import sanitizeHtml from "sanitize-html";

/**
 * Allowlist sanitizer for admin-authored campaign HTML.
 *
 * The body is written by an authenticated admin, but it is *stored* HTML that
 * is later re-rendered into a preview for other admins and mailed to thousands
 * of clients. Untreated, that gives a compromised or over-privileged staff
 * account a stored-XSS primitive against colleagues and a phishing vector in
 * mail clients.
 *
 * Two controls, deliberately layered:
 *   1. this allowlist, applied **on write and again on render**, so the stored
 *      row is clean and so rows written before this module existed (or by a
 *      future import path) are still safe;
 *   2. the panel preview renders into `<iframe sandbox="">`, which executes no
 *      script at all. That sandbox is the primary control — this sanitizer is
 *      what protects the *mail clients*, which have no such sandbox.
 *
 * `{placeholder}` tokens must survive untouched, including inside `href`, so
 * the allowlist deliberately permits relative-looking URLs.
 */

/** Structural and text tags an email body legitimately needs. */
const ALLOWED_TAGS = [
    "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "small",
    "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    "img", "hr", "blockquote", "center", "font",
];

/** Layout attributes that table-based email markup cannot do without. */
const TABLE_ATTRS = ["width", "height", "align", "valign", "bgcolor", "colspan", "rowspan", "cellpadding", "cellspacing", "border"];

export const AD_CAMPAIGN_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
        // `style` is allowed broadly because email layout is inline-style
        // driven; dangerous constructs are stripped by the transform below.
        "*": ["style", "class", "dir", "lang", "title", "role"],
        a: ["href", "target", "rel", "name"],
        img: ["src", "alt", "srcset", ...TABLE_ATTRS],
        table: TABLE_ATTRS,
        thead: TABLE_ATTRS, tbody: TABLE_ATTRS, tfoot: TABLE_ATTRS,
        tr: TABLE_ATTRS, td: TABLE_ATTRS, th: TABLE_ATTRS,
        font: ["color", "face", "size"],
        div: TABLE_ATTRS, p: ["align"], hr: TABLE_ATTRS,
    },

    // Anything not listed is dropped outright — `script`, `iframe`, `object`,
    // `embed`, `form`, `input`, `style`, `link`, `meta`, `base` included.
    // `discard` (not the default `escape`) so a dropped `<script>` body does
    // not reappear as visible text in the email.
    disallowedTagsMode: "discard",

    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
        // `cid:` is how inline attachments are referenced in email.
        img: ["http", "https", "cid"],
    },
    // Relative URLs must stay allowed or `href="{ctaUrl}"` would be stripped
    // before the placeholder is ever substituted.
    allowProtocolRelative: false,
    allowedSchemesAppliedToAttributes: ["href", "src"],

    // Comments can carry conditional-comment payloads; drop them.
    allowVulnerableTags: false,
    parser: {lowerCaseTags: true, lowerCaseAttributeNames: true},

    transformTags: {
        // Every outbound link opens externally and must not hand the opener a
        // window reference.
        a: (tagName, attribs) => {
            const next: Record<string, string> = {...attribs};
            if (next.target) next.rel = "noopener noreferrer";
            return {tagName, attribs: next};
        },
    },

    exclusiveFilter: undefined,
};

/**
 * CSS constructs that can execute or exfiltrate. Cheap belt to the sandbox's
 * braces. Not global — it is only ever used with `.test()` on one declaration
 * at a time, and a `g` flag would make that stateful via `lastIndex`.
 */
const DANGEROUS_CSS = /(expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behaviou?r\s*:)/i;

/**
 * Sanitize one campaign body.
 *
 * Returns `""` for empty input so callers can treat "no override" and "blank
 * override" identically.
 */
export function sanitizeAdCampaignHtml(html: string | null | undefined): string {
    if (!html || typeof html !== "string") return "";

    const cleaned = sanitizeHtml(html, AD_CAMPAIGN_SANITIZE_OPTIONS);

    // Strip dangerous CSS from any surviving inline style. Done after the
    // allowlist pass so it only ever sees attribute values sanitize-html kept.
    //
    // Whole offending *declarations* are dropped rather than just the matched
    // token: removing `expression(` alone would leave `width:alert(1))`, which
    // is inert but garbage. Sibling declarations are preserved.
    // The leading `\s*` is part of the match so that dropping the attribute
    // does not leave a dangling space (`<p >hi</p>`).
    return cleaned.replace(/\s*style="([^"]*)"/gi, (match, css: string) => {
        if (!DANGEROUS_CSS.test(css)) return match;
        const safe = css
            .split(";")
            .filter(decl => decl.trim() !== "" && !DANGEROUS_CSS.test(decl))
            .join(";");
        return safe ? ` style="${safe}"` : "";
    });
}
