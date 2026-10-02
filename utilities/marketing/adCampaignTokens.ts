import {ObjectId} from "mongodb";
import {clientHostFor} from "@coreModule/environment";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import Project from "@propertyManagement/database/schemas/project/project";
import type {IAdCampaign} from "@propertyManagement/database/schemas/adCampaign/adCampaign";
import type {AdCampaignTokenValues} from "../emails/adCampaignNotifier";
import {renderAdCampaignEmail} from "../emails/adCampaignNotifier";
import {
    AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
} from "./adCampaignSampleTokens";
import {decimalToNumber} from "@coreModule/utilities/mappers/common.mapper";
import {formatMoneyAmountForEmail, unitLocationForEmail} from "../emails/reservationEmailFormatting";
import {currentYear} from "../emails/emailLayout";

export class AdCampaignTokenError extends Error {
    constructor(readonly exceptionKey: string, readonly field?: string) {
        super(exceptionKey);
        this.name = "AdCampaignTokenError";
    }
}

/** Lean campaign refs are ObjectIds; a populated `{_id}` also shows up after populate. */
function asObjectId(value: unknown): ObjectId | undefined {
    if (value == null || value === "") return undefined;
    if (value instanceof ObjectId) return value;
    if (typeof value === "object" && value !== null && "_id" in value) {
        return asObjectId((value as {_id: unknown})._id);
    }
    const raw = String(value);
    return ObjectId.isValid(raw) ? new ObjectId(raw) : undefined;
}

function asIdList(value: unknown): ObjectId[] {
    if (!Array.isArray(value)) return [];
    return value.map(asObjectId).filter((id): id is ObjectId => !!id);
}

function moneyAmount(value: unknown): number | undefined {
    const n = decimalToNumber(value);
    return n != null && Number.isFinite(n) ? n : undefined;
}

export function formatPriceChangePercent(oldPrice: number, newPrice: number): string {
    if (oldPrice === 0) return newPrice === 0 ? "0%" : "+100%";
    const pct = ((newPrice - oldPrice) / oldPrice) * 100;
    const rounded = Math.round(pct * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded.toFixed(1)}%`;
}

export function formatOfferEndsAt(date: Date, languageCode: string): string {
    try {
        return new Intl.DateTimeFormat(languageCode, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

function formatPrice(raw: string, languageCode: string, symbol?: string): string {
    const amount = formatMoneyAmountForEmail(raw, languageCode);
    return symbol ? `${amount} ${symbol}` : amount;
}

/**
 * Public project page the CTA button should open.
 *
 * `unitId` is honoured by the open-project 3d view so a price-change mail can
 * land on the unit panel rather than the empty building.
 */
export function buildOpenProjectCtaUrl(projectId: string, unitId?: string): string {
    const host = clientHostFor("public");
    if (!host) return "";
    const params = new URLSearchParams({projectId});
    if (unitId) params.set("unitId", unitId);
    return `${host}/open-project/3d?${params.toString()}`;
}

export function recipientIdentityTokens(row: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
}): AdCampaignTokenValues {
    const firstName = row.firstName?.trim() || undefined;
    const lastName = row.lastName?.trim() || undefined;
    const fullName = row.fullName?.trim()
        || [firstName, lastName].filter(Boolean).join(" ")
        || undefined;
    return {
        firstName,
        lastName,
        fullName,
        email: row.email,
    };
}

type PriceHistoryEntry = {price?: unknown};

/**
 * History logs the *new* price after each change, so the previous price is
 * the second-to-last entry. The current `unit.price` is `{newPrice}`.
 */
export function previousPriceFromHistory(history: PriceHistoryEntry[] | undefined): number | undefined {
    if (!history || history.length < 2) return undefined;
    return moneyAmount(history[history.length - 2]?.price);
}

async function scopeNames(
    company: ObjectId,
    campaign: IAdCampaign,
): Promise<{projectNames?: string; unitList?: string}> {
    const projectIds = asIdList(campaign.projects);
    const unitIds = asIdList(campaign.units);
    const [projects, units] = await Promise.all([
        projectIds.length
            ? Project.find({_id: {$in: projectIds}, company}).select("name").lean<{name?: string}[]>()
            : Promise.resolve([]),
        unitIds.length
            ? Unit.find({_id: {$in: unitIds}, company}).select("name unitNumber").lean<{name?: string; unitNumber?: string}[]>()
            : Promise.resolve([]),
    ]);
    const projectNames = projects.map(p => p.name).filter((n): n is string => !!n).join(", ") || undefined;
    const unitList = units
        .map(u => u.unitNumber || u.name)
        .filter((n): n is string => !!n)
        .join(", ") || undefined;
    return {projectNames, unitList};
}

/**
 * Broadcast content tokens: the same for every recipient of this campaign.
 *
 * Throws {@link AdCampaignTokenError} when the campaign type requires inventory
 * that is missing (no content unit, no previous price, no content project).
 */
export async function resolveCampaignContentTokens(input: {
    campaign: IAdCampaign;
    company: ObjectId;
    languageCode: string;
    companyName: string;
}): Promise<AdCampaignTokenValues> {
    const {campaign, company, languageCode, companyName} = input;
    const tokens: AdCampaignTokenValues = {
        companyName,
        campaignTitle: campaign.title,
        year: currentYear(),
    };

    const overrideCta = campaign.ctaUrl?.trim() || undefined;
    const {projectNames, unitList} = await scopeNames(company, campaign);
    if (projectNames) tokens.projectNames = projectNames;
    if (unitList) tokens.unitList = unitList;

    if (campaign.campaignType === "price_change") {
        const unitId = asObjectId(campaign.contentUnit);
        if (!unitId) throw new AdCampaignTokenError("ad_campaign_content_unit_required", "contentUnit");

        const unit = await Unit.findOne({_id: unitId, company})
            .select("unitNumber name price priceHistory priceCurrency project")
            .populate("project", "name")
            .populate("priceCurrency", "symbol")
            .lean<{
                _id: ObjectId;
                unitNumber?: string;
                name?: string;
                price?: unknown;
                priceHistory?: PriceHistoryEntry[];
                priceCurrency?: {symbol?: string};
                project?: {_id?: ObjectId; name?: string} | ObjectId;
            }>();
        if (!unit) throw new AdCampaignTokenError("ad_campaign_content_unit_required", "contentUnit");

        const newPrice = moneyAmount(unit.price);
        const oldPrice = previousPriceFromHistory(unit.priceHistory);
        if (newPrice == null || oldPrice == null) {
            throw new AdCampaignTokenError("ad_campaign_no_price_history", "contentUnit");
        }

        const symbol = unit.priceCurrency?.symbol;
        const projectId = asObjectId(unit.project);
        tokens.unitNumber = unit.unitNumber || unit.name || undefined;
        tokens.projectName = unitLocationForEmail({project: unit.project}).projectName;
        tokens.oldPrice = formatPrice(String(oldPrice), languageCode, symbol);
        tokens.newPrice = formatPrice(String(newPrice), languageCode, symbol);
        tokens.priceChangePercent = formatPriceChangePercent(oldPrice, newPrice);
        tokens.ctaUrl = overrideCta || (projectId ? buildOpenProjectCtaUrl(projectId.toString(), unit._id.toString()) : undefined);
        return tokens;
    }

    if (campaign.campaignType === "offer") {
        if (!campaign.offerTitle?.trim()) {
            throw new AdCampaignTokenError("ad_campaign_offer_fields_required", "offerTitle");
        }
        if (!campaign.offerEndsAt) {
            throw new AdCampaignTokenError("ad_campaign_offer_fields_required", "offerEndsAt");
        }
        tokens.offerTitle = campaign.offerTitle.trim();
        tokens.offerEndsAt = formatOfferEndsAt(campaign.offerEndsAt, languageCode);

        const projectId = asObjectId(campaign.contentProject);
        if (projectId) {
            const project = await Project.findOne({_id: projectId, company}).select("name").lean<{name?: string}>();
            if (project?.name) tokens.projectName = project.name;
            tokens.ctaUrl = overrideCta || buildOpenProjectCtaUrl(projectId.toString());
        } else {
            tokens.ctaUrl = overrideCta;
        }
        return tokens;
    }

    // new_project
    const projectId = asObjectId(campaign.contentProject);
    if (!projectId) throw new AdCampaignTokenError("ad_campaign_content_project_required", "contentProject");
    const project = await Project.findOne({_id: projectId, company}).select("name").lean<{name?: string}>();
    if (!project) throw new AdCampaignTokenError("ad_campaign_content_project_required", "contentProject");
    tokens.projectName = project.name;
    tokens.ctaUrl = overrideCta || buildOpenProjectCtaUrl(projectId.toString());
    return tokens;
}

export function mergeCampaignTokens(
    content: AdCampaignTokenValues,
    identity: AdCampaignTokenValues,
): AdCampaignTokenValues {
    return {...content, ...identity};
}

export function throwIfUnresolved(unresolved: string[]): void {
    const remaining = unresolved.filter(token => token !== "unsubscribeUrl" && token !== "preferencesUrl");
    if (remaining.length === 0) return;
    throw new AdCampaignTokenError("ad_campaign_unresolved_placeholders");
}

/** Render with identity stand-ins and refuse to queue if tokens would ship as braces. */
export function assertTokensFillTemplate(input: {
    bodyHtml: string;
    subject: string;
    previewText?: string;
    languageCode: string;
    companyName: string;
    tokens: AdCampaignTokenValues;
}): void {
    const rendered = renderAdCampaignEmail({
        bodyHtml: input.bodyHtml,
        subject: input.subject,
        previewText: input.previewText,
        languageCode: input.languageCode,
        companyName: input.companyName,
        fullName: "Ana Marku",
        tokens: mergeCampaignTokens(input.tokens, {
            firstName: "Ana",
            lastName: "Marku",
            fullName: "Ana Marku",
            email: "ana.marku@example.com",
        }),
        unsubscribeUrl: AD_CAMPAIGN_PREVIEW_UNSUBSCRIBE_URL,
        preferencesUrl: AD_CAMPAIGN_PREVIEW_PREFERENCES_URL,
    });
    throwIfUnresolved(rendered.unresolvedPlaceholders);
}
