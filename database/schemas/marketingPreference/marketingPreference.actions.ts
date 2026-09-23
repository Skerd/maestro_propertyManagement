import {action} from "@coreModule/api/actionDecorator";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {
    MarketingPreferenceState,
    MarketingPreferenceUpdateForm,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/marketingPreference.dto";
import {marketingPreferenceService, normalizeEmail} from "./marketingPreference.service";

/**
 * The authenticated person's own address.
 *
 * Client email *is* `User.username` — core `User` has no separate email field.
 * A user without one cannot have marketing preferences, because there is
 * nowhere to send them anything.
 */
function ownEmail(params: Record<string, any>): string {
    const username = params.userInfo?.username;
    if (typeof username !== "string" || username.trim() === "") {
        throw apiValidationException("user_has_no_email", "username", null, params.languageCode);
    }
    return normalizeEmail(username);
}

export class MarketingPreferenceActions {
    /**
     * The caller's own marketing preferences for the active company.
     *
     * Returns all-true defaults when no row exists, so the account page never
     * has to special-case "never set anything".
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 60},
    })
    async me(params: Record<string, any>): Promise<MarketingPreferenceState> {
        const {logger, company} = params;
        const email = ownEmail(params);

        logger.start(`Reading marketing preferences for ${email}...`);
        const state = await marketingPreferenceService.getState(company._id, email);
        logger.finish("Marketing preferences read");
        return state;
    }

    /**
     * Update the caller's own preferences.
     *
     * The subject is taken from the session, never from the body — otherwise
     * any authenticated user could rewrite anyone else's consent.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
    })
    async updateMe(params: Record<string, any>): Promise<MarketingPreferenceState> {
        const {logger, company, userInfo} = params;
        const email = ownEmail(params);

        const update: MarketingPreferenceUpdateForm = {
            allowPriceChange: params.allowPriceChange,
            allowOffers: params.allowOffers,
            allowNewProjects: params.allowNewProjects,
            unsubscribeAll: params.unsubscribeAll,
        };

        logger.start(`Updating marketing preferences for ${email}...`);
        const state = await marketingPreferenceService.applyUpdate({
            company: company._id,
            email,
            update,
            source: "account_page",
            user: userInfo?._id ?? null,
        });
        logger.finish("Marketing preferences updated");
        return state;
    }
}
