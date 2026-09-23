import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    validateUnsubscribeToken,
    type UnsubscribeTokenPayload,
} from "@coreModule/utilities/security/unsubscribeToken";
import Company from "@coreModule/database/schemas/company/company";
import User from "@coreModule/database/schemas/user/user";
import {
    adCampaignUnsubscribeFormSchema,
    adCampaignUnsubscribeReadFormSchema,
    adCampaignUnsubscribeUpdateFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/adCampaignUnsubscribe/adCampaignUnsubscribe.form.validator";
import type {AdCampaignUnsubscribeResponse} from "armonia/src/modules/propertyManagement/api/realEstate/public/adCampaignUnsubscribe/adCampaignUnsubscribe.dto";
import type {AdCampaignType} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {marketingPreferenceService} from "../../../database/schemas/marketingPreference/marketingPreference.service";
import Lead from "../../../database/schemas/lead/lead";
import AdCampaignRecipient from "../../../database/schemas/adCampaignRecipient/adCampaignRecipient";

const router = Router();

/**
 * Login-less marketing preference endpoints.
 *
 * The token is the only credential and the only source of identity and tenant.
 * In particular the company comes from `payload.companyId`, **never** from the
 * request origin: this is the one public route where origin-based tenant
 * resolution is wrong, because the link is opened from an arbitrary mail client
 * and a forwarded message must still resolve to the right tenant.
 *
 * Nothing here mutates on a GET. Outlook SafeLinks, Proofpoint and similar
 * scanners fetch every link in a message, so a mutating GET would unsubscribe
 * people who never clicked. The emailed link points at the sinfonia public app,
 * which POSTs here once it has actually rendered.
 */

type TokenBody = NotAuthenticatedMWType & {token: string};
type UpdateBody = TokenBody & {
    allowPriceChange?: boolean;
    allowOffers?: boolean;
    allowNewProjects?: boolean;
    unsubscribeAll?: boolean;
};

async function resolveContext(payload: UnsubscribeTokenPayload, languageCode: string) {
    const companyId = new ObjectId(payload.companyId);
    const company = await Company.findById(companyId).select("name").lean<{_id: ObjectId; name?: string}>();
    if (!company) {
        throw apiValidationException("company_not_found", "token", null, languageCode);
    }

    // Best-effort back-references so the stored consent row can be linked to
    // whoever this address belongs to. Their absence is not an error — a lead
    // may have been deleted, or the address may belong to neither any more.
    const [user, lead] = await Promise.all([
        User.findOne({username: payload.email, companies: companyId}).select("_id").lean<{_id: ObjectId}>(),
        Lead.findOne({email: payload.email, company: companyId}).select("_id").lean<{_id: ObjectId}>(),
    ]);

    return {companyId, companyName: company.name ?? "", user: user?._id ?? null, lead: lead?._id ?? null};
}

/** Record on the delivery row that this recipient used the link. */
async function stampRecipient(payload: UnsubscribeTokenPayload, companyId: ObjectId): Promise<void> {
    if (!payload.campaignId) return;
    await AdCampaignRecipient.updateOne(
        {campaign: new ObjectId(payload.campaignId), company: companyId, email: payload.email},
        {$set: {unsubscribedAt: new Date()}},
    );
}

async function respond(
    payload: UnsubscribeTokenPayload,
    ctx: {companyId: ObjectId; companyName: string},
): Promise<AdCampaignUnsubscribeResponse> {
    return {
        companyName: ctx.companyName,
        campaignType: payload.campaignType as AdCampaignType | undefined,
        preferences: await marketingPreferenceService.getState(ctx.companyId, payload.email),
    };
}

/**
 * One-click: opt out of the campaign's own type, or of everything when the
 * token names no type.
 */
async function unsubscribeOnce(params: TokenBody): Promise<AdCampaignUnsubscribeResponse> {
    const {token, languageCode, logger} = params;
    const payload = validateUnsubscribeToken(token, languageCode);
    logger.start(`Unsubscribe click for ${payload.email}`);

    const ctx = await resolveContext(payload, languageCode);

    if (payload.campaignType) {
        await marketingPreferenceService.optOutOfType({
            company: ctx.companyId,
            email: payload.email,
            campaignType: payload.campaignType as AdCampaignType,
            source: "unsubscribe_link",
            user: ctx.user,
            lead: ctx.lead,
        });
    }
    else {
        await marketingPreferenceService.optOutOfAll({
            company: ctx.companyId,
            email: payload.email,
            source: "unsubscribe_link",
            user: ctx.user,
            lead: ctx.lead,
        });
    }

    await stampRecipient(payload, ctx.companyId);
    logger.finish(`Unsubscribed ${payload.email} from ${payload.campaignType ?? "all"}`);
    return respond(payload, ctx);
}

/** Read current preferences behind a token, changing nothing. */
async function readPreferences(params: TokenBody): Promise<AdCampaignUnsubscribeResponse> {
    const {token, languageCode} = params;
    const payload = validateUnsubscribeToken(token, languageCode);
    const ctx = await resolveContext(payload, languageCode);
    return respond(payload, ctx);
}

/** Write the toggles from the manage page. */
async function updatePreferences(params: UpdateBody): Promise<AdCampaignUnsubscribeResponse> {
    const {token, languageCode, logger, allowPriceChange, allowOffers, allowNewProjects, unsubscribeAll} = params;
    const payload = validateUnsubscribeToken(token, languageCode);
    logger.start(`Updating marketing preferences for ${payload.email}`);

    const ctx = await resolveContext(payload, languageCode);
    await marketingPreferenceService.applyUpdate({
        company: ctx.companyId,
        email: payload.email,
        update: {allowPriceChange, allowOffers, allowNewProjects, unsubscribeAll},
        source: "unsubscribe_link",
        user: ctx.user,
        lead: ctx.lead,
    });

    if (unsubscribeAll) await stampRecipient(payload, ctx.companyId);
    logger.finish(`Marketing preferences updated for ${payload.email}`);
    return respond(payload, ctx);
}

/**
 * RFC 8058 one-click endpoint.
 *
 * Gmail and Yahoo POST here directly, with the token in the query string and a
 * body of `List-Unsubscribe=One-Click` rather than JSON — so the token is read
 * from the query and the body is ignored entirely.
 */
async function oneClick(params: NotAuthenticatedMWType, _p: unknown, req: any): Promise<{ok: true}> {
    const token = String(req?.query?.token ?? "");
    const payload = validateUnsubscribeToken(token, params.languageCode);
    const ctx = await resolveContext(payload, params.languageCode);

    if (payload.campaignType) {
        await marketingPreferenceService.optOutOfType({
            company: ctx.companyId,
            email: payload.email,
            campaignType: payload.campaignType as AdCampaignType,
            source: "unsubscribe_link",
            user: ctx.user,
            lead: ctx.lead,
        });
    }
    else {
        await marketingPreferenceService.optOutOfAll({
            company: ctx.companyId,
            email: payload.email,
            source: "unsubscribe_link",
            user: ctx.user,
            lead: ctx.lead,
        });
    }

    await stampRecipient(payload, ctx.companyId);
    return {ok: true};
}

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 20}),
    validateFormZod(adCampaignUnsubscribeFormSchema),
    asyncHandler(unsubscribeOnce),
);

router.post(
    "/preferences",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(adCampaignUnsubscribeReadFormSchema),
    asyncHandler(readPreferences),
);

router.patch(
    "/preferences",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(adCampaignUnsubscribeUpdateFormSchema),
    asyncHandler(updatePreferences),
);

// No `validateFormZod`: mail providers post a form body, not JSON.
router.post(
    "/oneClick",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    asyncHandler(oneClick),
);

export const basePath = "/api/realEstate/adCampaignUnsubscribe";
module.exports = {router, basePath};
