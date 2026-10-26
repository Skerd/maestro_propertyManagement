import {ICompany} from "@coreModule/database/schemas/company/company";
import {resolveCompanyByOrigin} from "@coreModule/utilities/marketing/resolveCompanyByOrigin";
import {isPortalOrigin} from "@coreModule/utilities/marketing/platformShopOrigin";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {propertyManagementConfigService} from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.service";

/**
 * Resolves the marketing tenant company from the request origin (public site domain).
 * Falls back to the first active company with wildcard allowedDomains for local development.
 *
 * Wrapper over the core resolver — the logic moved to {@link resolveCompanyByOrigin}
 * so the core public-chat endpoints can share it (core cannot import propertyManagement).
 * On the portal, the company must also have opted in to being listed there.
 */
export async function resolveMarketingCompany(
    origin: string,
    languageCode: string,
): Promise<ICompany> {
    const company = await resolveCompanyByOrigin(origin, languageCode);
    if (isPortalOrigin(origin)) {
        const config = await propertyManagementConfigService.findOne({company: company._id}, {languageCode, withDeleted: false});
        if (!config?.listedOnPortal) {
            throw apiValidationException("portal_company_not_listed", "", null, languageCode);
        }
    }
    return company;
}
