import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {decimal128ToNumber, objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {
    marketingFeaturedUnitsFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingFeaturedUnits/marketingFeaturedUnits.form.validator";
import {
    MarketingFeaturedUnitsFormResponseType
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingFeaturedUnits/marketingFeaturedUnits.form.response.type";
import {resolveMarketingCompany} from "../../../utilities/marketing/marketingCompany.util";
import {
    marketingMediaUrl,
    marketingMediaUrls,
} from "../../../utilities/mappers/marketing/marketing.mapper";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {mapUnitTypeToPropertyTypeId} from "../../../utilities/marketing/marketingPropertyType.util";

const FEATURED_LIMIT = 12;

const router = Router();

type MarketingFeaturedUnitsParams = NotAuthenticatedMWType;

function mapUnitStatus(status: string | undefined): "available" | "reserved" | "sold" {
    switch (status) {
        case UnitStatus.RESERVED:
            return "reserved";
        case UnitStatus.SOLD:
            return "sold";
        default:
            return "available";
    }
}

router.post(
    "",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod(marketingFeaturedUnitsFormSchema),
    asyncHandler(marketingFeaturedUnits),
);

async function marketingFeaturedUnits(
    params: MarketingFeaturedUnitsParams,
): Promise<MarketingFeaturedUnitsFormResponseType> {
    const {origin, languageCode, logger} = params;
    logger.start("Loading marketing featured units...");

    const company = await resolveMarketingCompany(origin, languageCode);
    const companyId = company._id;

    const units = await unitService.find(
        {
            company: companyId,
            deletedAt: null,
            featuredOnHomepage: true,
        },
        {logger, languageCode},
        [
            "mainImage",
            "imageGallery",
            "unitType",
            {
                path: "floor",
                populate: {
                    path: "edifice",
                    populate: {path: "project"},
                },
            },
        ],
        undefined,
        {featuredSortOrder: 1, name: 1},
        FEATURED_LIMIT,
    );

    const mapped = units.map((unit: any) => {
        const floor = unit.floor;
        const edifice = floor?.edifice;
        const project = edifice?.project;
        const price = decimal128ToNumber(unit.price);

        return {
            _id: objectIdToString(unit._id),
            name: unit.name,
            unitNumber: unit.unitNumber,
            status: mapUnitStatus(unit.status),
            areaSqm: unit.netArea ?? unit.area,
            bedrooms: unit.numberOfRooms,
            bathrooms: unit.numberOfBathrooms,
            price,
            mainImage: marketingMediaUrl(unit.mainImage),
            imageGallery: marketingMediaUrls(unit.imageGallery),
            propertyType: mapUnitTypeToPropertyTypeId(unit.unitType),
            hasSeaView: !!unit.hasSeaView,
            hasCityView: !!unit.hasCityView,
            hasLakeView: !!unit.hasLakeView,
            hasBalcony: !!unit.hasBalcony,
            hasTerrace: !!unit.hasTerrace,
            projectId: project ? objectIdToString(project._id) : unit.project ? objectIdToString(unit.project) : undefined,
            projectName: project?.name,
            edificeId: edifice ? objectIdToString(edifice._id) : unit.edifice ? objectIdToString(unit.edifice) : undefined,
            edificeName: edifice?.name,
            floorId: floor ? objectIdToString(floor._id) : undefined,
            floorLabel: floor?.name,
        };
    });

    logger.finish(`Loaded ${mapped.length} featured marketing units`);
    return {
        units: mapped,
        total: mapped.length,
    };
}

export const basePath = "/api/realEstate/marketingFeaturedUnits";
module.exports = {router, basePath};
