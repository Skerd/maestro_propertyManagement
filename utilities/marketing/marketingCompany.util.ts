import {ICompany} from "@coreModule/database/schemas/company/company";
import {resolveCompanyByOrigin} from "@coreModule/utilities/marketing/resolveCompanyByOrigin";

/**
 * Resolves the marketing tenant company from the request origin (public site domain).
 * Falls back to the first active company with wildcard allowedDomains for local development.
 *
 * Thin wrapper over the core resolver — the logic moved to
 * {@link resolveCompanyByOrigin} so the core public-chat endpoints can share it
 * (core cannot import propertyManagement).
 */
export async function resolveMarketingCompany(
    origin: string,
    languageCode: string,
): Promise<ICompany> {
    return resolveCompanyByOrigin(origin, languageCode);
}
