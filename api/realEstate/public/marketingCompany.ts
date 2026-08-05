import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {
    marketingCompanyFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingCompany/marketingCompany.form.validator";
import {
    MarketingCompanyAddressItem,
    MarketingCompanyFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingCompany/marketingCompany.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";

const router = Router();

type MarketingCompanyParams = NotAuthenticatedMWType;

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingCompanyFormSchema),
    asyncHandler(marketingCompany),
);

function optionalTrimmed(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function namedRef(value: unknown): string | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    return optionalTrimmed((value as {name?: unknown}).name);
}

function optionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapCompanyAddresses(
    company: {
        addresses?: Array<{
            street?: string;
            city?: unknown;
            country?: unknown;
            latitude?: number;
            longitude?: number;
        }>;
    },
): MarketingCompanyAddressItem[] | undefined {
    if (!Array.isArray(company.addresses) || company.addresses.length === 0) {
        return undefined;
    }

    const mapped = company.addresses.flatMap((address) => {
        const city = namedRef(address.city);
        const country = namedRef(address.country);
        const street = optionalTrimmed(address.street);
        const label =
            city && country
                ? `${city}, ${country}`
                : city || country || street;

        if (!label) {
            return [];
        }

        const item: MarketingCompanyAddressItem = {label};
        const latitude = optionalNumber(address.latitude);
        const longitude = optionalNumber(address.longitude);
        if (latitude !== undefined) {
            item.latitude = latitude;
        }
        if (longitude !== undefined) {
            item.longitude = longitude;
        }
        return [item];
    });

    return mapped.length > 0 ? mapped : undefined;
}

async function marketingCompany(params: MarketingCompanyParams): Promise<MarketingCompanyFormResponseType> {
    const {origin, languageCode, logger} = params;
    logger.start("Loading marketing company contact...");

    const company = await resolveMarketingCompany(origin, languageCode);
    await company.populate([
        {path: "addresses.city", select: "name"},
        {path: "addresses.country", select: "name"},
    ]);

    const response: MarketingCompanyFormResponseType = {
        email: optionalTrimmed(company.email),
        phoneNumber: optionalTrimmed(company.phoneNumber),
        addresses: mapCompanyAddresses(company),
        website: optionalTrimmed(company.website),
        linkedin: optionalTrimmed(company.linkedin),
        instagram: optionalTrimmed(company.instagram),
        facebook: optionalTrimmed(company.facebook),
    };

    logger.finish(`Loaded marketing company contact for ${company.name}`);
    return response;
}

export const basePath = "/api/realEstate/marketingCompany";
module.exports = {router, basePath};
