import {Decimal128, ObjectId} from "mongodb";
import Edifice from "./edifice";
import Constructor from "@propertyManagement/database/schemas/constructor/constructor";
import Currency from "@coreModule/database/schemas/currency/currency";
import Country from "@coreModule/database/schemas/country/country";
import State from "@coreModule/database/schemas/state/state";
import City from "@coreModule/database/schemas/city/city";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {edificesSeed} from "@propertyManagement/database/seeds/hierarchy/edifices.seed";
import type {SeedAddress} from "@propertyManagement/database/seeds/hierarchy/types";

export {edificesSeed as defaultEdifices};

/**
 * Resolves the business keys the exporter emitted (currency abbreviation, constructor
 * VAT, country/state/city code or name) back to ids in the freshly seeded database.
 * Built once per run rather than per row — the geo collections are large.
 */
async function buildResolvers(company: ICompany) {
    const [currencies, constructors] = await Promise.all([
        Currency.find({}).select("_id abbreviation").lean(),
        Constructor.find({company: company._id}).select("_id vat").lean(),
    ]);

    const currencyByCode = new Map<string, ObjectId>(
        (currencies as any[]).map((c) => [String(c.abbreviation), c._id as ObjectId]),
    );
    const constructorByVat = new Map<string, ObjectId>(
        (constructors as any[]).map((c) => [String(c.vat), c._id as ObjectId]),
    );

    return {currencyByCode, constructorByVat};
}

async function resolveAddress(
    address: SeedAddress | undefined,
    company: ICompany,
    logger: serverLogger,
    context: string,
): Promise<Record<string, unknown> | undefined> {
    if (!address) {
        return undefined;
    }

    const country = address.countryCode
        ? await Country.findOne({code: address.countryCode, company: company._id}).select("_id")
        : null;
    const state = address.stateCode
        ? await State.findOne({
              code: address.stateCode,
              company: company._id,
              ...(country ? {country: country._id} : {}),
          }).select("_id")
        : null;
    const city = address.cityName
        ? await City.findOne({
              name: address.cityName,
              company: company._id,
              ...(state ? {state: state._id} : {}),
          }).select("_id")
        : null;

    if (address.countryCode && !country) {
        logger.warn(`${context}: country "${address.countryCode}" not found; address left partial.`);
    }
    if (address.cityName && !city) {
        logger.warn(`${context}: city "${address.cityName}" not found; address left partial.`);
    }

    return {
        street: address.street,
        postalCode: address.postalCode,
        ...(country ? {country: country._id} : {}),
        ...(state ? {state: state._id} : {}),
        ...(city ? {city: city._id} : {}),
        latitude: address.latitude,
        longitude: address.longitude,
    };
}

/**
 * Seeds the demo edifices. Runs after {@link createProjects} — every edifice needs a
 * project, and the schema requires `mainImage`, `address`, `investmentValue`,
 * `investmentCurrency` and `polygonCoordinates`.
 */
export async function createEdifices(
    parentLogger: serverLogger,
    company: ICompany,
    availableMedia: Set<string>,
    projectIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createEdifices", parentLogger);
    logger.start(`Creating edifices (${edificesSeed.length})...`);

    const {currencyByCode, constructorByVat} = await buildResolvers(company);
    const created = new Map<string, ObjectId>();

    for (const row of edificesSeed) {
        try {
            const project = row.projectId ? projectIds.get(row.projectId) : undefined;
            if (!project) {
                logger.warn(`Skipping edifice "${row.name}": its project was not seeded.`);
                continue;
            }

            const mainImage =
                row.mainImageId && availableMedia.has(row.mainImageId)
                    ? new ObjectId(row.mainImageId)
                    : undefined;
            if (!mainImage) {
                logger.warn(`Skipping edifice "${row.name}": its main image was not seeded (field is required).`);
                continue;
            }

            const investmentCurrency = row.investmentCurrencyCode
                ? currencyByCode.get(row.investmentCurrencyCode)
                : undefined;
            if (!investmentCurrency) {
                logger.warn(
                    `Skipping edifice "${row.name}": currency "${row.investmentCurrencyCode}" not found (field is required).`,
                );
                continue;
            }

            const edificeId = new ObjectId(row.id);
            const constructors = row.constructorVats
                .map((vat) => constructorByVat.get(vat))
                .filter((id): id is ObjectId => Boolean(id));

            if (constructors.length !== row.constructorVats.length) {
                logger.warn(`Edifice "${row.name}": some constructors could not be resolved by VAT.`);
            }

            const payload = {
                name: row.name,
                project,
                address: await resolveAddress(row.address, company, logger, `edifice "${row.name}"`),
                commercialFacilities: row.commercialFacilities,
                neighborhoodFacilities: row.neighborhoodFacilities,
                investmentValue: Decimal128.fromString(row.investmentValue ?? "0"),
                investmentCurrency,
                pricePerMeterSquared: row.pricePerMeterSquared,
                verandaPricePerMeterSquared: row.verandaPricePerMeterSquared,
                ...(row.saleCurrencyCode && currencyByCode.get(row.saleCurrencyCode)
                    ? {saleCurrency: currencyByCode.get(row.saleCurrencyCode)}
                    : {}),
                constructors,
                propertyTypes: [],
                polygonCoordinates: row.polygonCoordinates.map((p) => ({x: p.x, y: p.y})),
                ...(row.constructionStartDate ? {constructionStartDate: new Date(row.constructionStartDate)} : {}),
                ...(row.expectedCompletionDate ? {expectedCompletionDate: new Date(row.expectedCompletionDate)} : {}),
                distanceFromCityCenter: row.distanceFromCityCenter,
                energyClass: row.energyClass,
                greenArea: row.greenArea,
                totalArea: row.totalArea,
                numberOfFloors: row.numberOfFloors,
                numberOfFloorsAboveGround: row.numberOfFloorsAboveGround,
                numberOfFloorsUnderGround: row.numberOfFloorsUnderGround,
                numberOfGarages: row.numberOfGarages,
                numberOfParkingSpaces: row.numberOfParkingSpaces,
                mainImage,
                imageGallery: [],
                videoGallery: [],
                mediaFiles: [],
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Edifice.findById(edificeId);
            if (existing) {
                existing.set(payload);
                await existing.save();
                logger.debug(`Edifice "${row.name}" already exists; updated fields`);
            } else {
                await Edifice.create({_id: edificeId, ...payload});
                logger.debug(`Successfully created edifice "${row.name}"`);
            }

            created.set(row.id, edificeId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating edifice "${row.name}": ${message}`);
        }
    }

    if (created.size === 0) {
        logger.fail("Failed to create edifices!");
    } else {
        logger.finish("Finished creating edifices!", created.size);
    }

    return created;
}
