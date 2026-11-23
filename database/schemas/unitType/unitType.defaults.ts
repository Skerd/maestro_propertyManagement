import UnitType from "./unitType";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import slugify from "slugify";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {ClientSession, Types} from "mongoose";
import type {SupportedLocale} from "armonia/src/modules/core/constants";
import {resolveEmailLocaleTag} from "@coreModule/utilities/emails/emailLocale";
import {unitTypeService} from "./unitType.service";
import {
    createStarterUnitTypeCategories,
    type StarterUnitTypeCategoryKey,
} from "../unitTypeCategory/unitTypeCategory.defaults";

/**
 * The unit types a new property company starts with (TD-B254), so it can add its first unit without building the
 * catalogue first. Names follow each market's own convention (Albanian 2+1, Italian trilocale, Swiss 3,5 Zimmer).
 * `slug` is the stable key: no form writes it, so a second run adds nothing and never undoes a rename.
 */
export const starterUnitTypes: readonly {slug: string; category: StarterUnitTypeCategoryKey; icon: string; names: Record<SupportedLocale, string>}[] = [
    {slug: "studio", category: "residential", icon: "mdiHomeOutline",
        names: {"en-US": "Studio", "de-CH": "Studio", "fr-FR": "Studio", "it-IT": "Monolocale", "sq-AL": "Garsonierë"}},
    {slug: "apartment-1-bedroom", category: "residential", icon: "mdiHomeCity",
        names: {"en-US": "1-bedroom apartment", "de-CH": "2,5-Zimmer-Wohnung", "fr-FR": "Appartement 2 pièces", "it-IT": "Bilocale", "sq-AL": "Apartament 1+1"}},
    {slug: "apartment-2-bedroom", category: "residential", icon: "mdiHomeCity",
        names: {"en-US": "2-bedroom apartment", "de-CH": "3,5-Zimmer-Wohnung", "fr-FR": "Appartement 3 pièces", "it-IT": "Trilocale", "sq-AL": "Apartament 2+1"}},
    {slug: "apartment-3-bedroom", category: "residential", icon: "mdiHomeCity",
        names: {"en-US": "3-bedroom apartment", "de-CH": "4,5-Zimmer-Wohnung", "fr-FR": "Appartement 4 pièces", "it-IT": "Quadrilocale", "sq-AL": "Apartament 3+1"}},
    {slug: "shop", category: "commercial", icon: "mdiStorefront",
        names: {"en-US": "Shop", "de-CH": "Ladenlokal", "fr-FR": "Local commercial", "it-IT": "Negozio", "sq-AL": "Dyqan"}},
    {slug: "office", category: "commercial", icon: "mdiOfficeBuilding",
        names: {"en-US": "Office", "de-CH": "Büro", "fr-FR": "Bureau", "it-IT": "Ufficio", "sq-AL": "Zyrë"}},
];

/**
 * Gives a new property company its starter categories and unit types, named in `languageCode` (the language it was
 * created in; English for one the platform does not ship). Adds only what is missing, so it may run again.
 */
export async function createStarterUnitTypes(
    company: ICompany,
    languageCode: string,
    {session, logger}: {session: ClientSession; logger: serverLogger},
): Promise<void> {
    const locale = resolveEmailLocaleTag(languageCode);
    const categoryIds = await createStarterUnitTypeCategories(company, locale, {session, logger});
    const auditUserId = company.createdBy?._id;
    for (const {slug, category, icon, names} of starterUnitTypes) {
        // A deleted starter type counts: the company removed it on purpose, and its slug stays unique per company.
        const existing = await unitTypeService.findOne({company: company._id, slug}, {session, logger, withDeleted: true}, undefined, "_id");
        if (existing) continue;
        await unitTypeService.create(
            {name: names[locale], slug, category: categoryIds.get(category), icon, company: company._id},
            {session, logger, auditUserId},
        );
    }
}

export const defaultUnitTypes = [
    // =========================
    // Residential
    // =========================
    {
        name: 'Studio',
        category: 'Residential',
        group: 'Apartment',
        description: 'A single-room residential unit combining living, sleeping, and kitchen areas.',
        icon: 'mdiHomeOutline',
    },
    {
        name: 'Apartment',
        category: 'Residential',
        group: 'Apartment',
        description: 'A self-contained residential unit within a larger building.',
        icon: 'mdiHomeCity',
    },
    {
        name: 'Loft',
        category: 'Residential',
        group: 'Apartment',
        description: 'An open-plan residential unit, often with high ceilings and minimal partitions.',
        icon: 'mdiHomeModern',
    },
    {
        name: 'Duplex Unit',
        category: 'Residential',
        group: 'Apartment',
        description: 'A residential unit spread across two internal floors.',
        icon: 'mdiHomeFloor2',
    },
    {
        name: 'Penthouse',
        category: 'Residential',
        group: 'Luxury',
        description: 'A premium residential unit located on the top floor of a building.',
        icon: 'mdiCrown',
    },
    {
        name: 'Garden Apartment',
        category: 'Residential',
        group: 'Apartment',
        description: 'An apartment with direct access to a private or semi-private garden.',
        icon: 'mdiFlower',
    },
    {
        name: 'Villa',
        category: 'Residential',
        group: 'House',
        description: 'A standalone residential building, usually with private outdoor space.',
        icon: 'mdiHomeVariant',
    },
    {
        name: 'Luxury Villa',
        category: 'Residential',
        group: 'Luxury',
        description: 'A high-end standalone residence with premium finishes and amenities.',
        icon: 'mdiHomeHeart',
    },
    {
        name: 'Townhouse',
        category: 'Residential',
        group: 'House',
        description: 'A multi-floor residential unit sharing side walls with adjacent houses.',
        icon: 'mdi-home-group',
    },
    {
        name: 'Detached House',
        category: 'Residential',
        group: 'House',
        description: 'A standalone residential building not sharing walls with other structures.',
        icon: 'mdi-home',
    },

    // =========================
    // Commercial
    // =========================
    {
        name: 'Office Unit',
        category: 'Commercial',
        group: 'Office',
        description: 'A commercial unit intended for administrative or professional work.',
        icon: 'mdiOfficeBuilding',
    },
    {
        name: 'Retail Unit',
        category: 'Commercial',
        group: 'Retail',
        description: 'A commercial unit designed for selling goods or services.',
        icon: 'mdiStorefront',
    },
    {
        name: 'Shop',
        category: 'Commercial',
        group: 'Retail',
        description: 'A small retail unit intended for direct customer interaction.',
        icon: 'mdiShopping',
    },
    {
        name: 'Showroom',
        category: 'Commercial',
        group: 'Retail',
        description: 'A commercial space for displaying products rather than direct sales.',
        icon: 'mdiStore',
    },
    {
        name: 'Co-Working Space',
        category: 'Commercial',
        group: 'Office',
        description: 'A shared office environment used by multiple individuals or companies.',
        icon: 'mdiAccountGroup',
    },

    // =========================
    // Parking
    // =========================
    {
        name: 'Parking Space',
        category: 'Parking',
        group: 'Parking',
        description: 'A designated space for parking a single vehicle.',
        icon: 'mdiParking',
    },
    {
        name: 'Covered Parking Space',
        category: 'Parking',
        group: 'Parking',
        description: 'A parking space protected by a roof or structure.',
        icon: 'mdiParkingCovered',
    },
    {
        name: 'Underground Parking',
        category: 'Parking',
        group: 'Parking',
        description: 'A parking space located below ground level.',
        icon: 'mdiGarage',
    },
    {
        name: 'Visitor Parking',
        category: 'Parking',
        group: 'Parking',
        description: 'A shared parking area intended for visitors.',
        icon: 'mdiCarMultiple',
        isPrivate: false,
    },
    {
        name: 'Motorcycle Parking',
        category: 'Parking',
        group: 'Parking',
        description: 'A parking space designated for motorcycles.',
        icon: 'mdiMotorbike',
    },
    {
        name: 'Bicycle Parking',
        category: 'Parking',
        group: 'Parking',
        description: 'A parking area designated for bicycles.',
        icon: 'mdiBike',
        isPrivate: false,
    },
    {
        name: 'Private Garage',
        category: 'Parking',
        group: 'Garage',
        description: 'An enclosed private space for vehicle parking.',
        icon: 'mdiGarageOpen',
    },
    {
        name: 'Shared Garage',
        category: 'Parking',
        group: 'Garage',
        description: 'An enclosed vehicle parking area shared by multiple users.',
        icon: 'mdiGarageVariant',
        isPrivate: false,
    },

    // =========================
    // Storage
    // =========================
    {
        name: 'Storage Unit',
        category: 'Storage',
        group: 'Storage',
        description: 'A designated space for storing personal or commercial items.',
        icon: 'mdiArchive',
    },
    {
        name: 'Basement Storage',
        category: 'Storage',
        group: 'Storage',
        description: 'A storage unit located in the basement of a building.',
        icon: 'mdiPackageDown',
    },
    {
        name: 'Locker',
        category: 'Storage',
        group: 'Storage',
        description: 'A small lockable storage compartment.',
        icon: 'mdiLocker',
    },

    // =========================
    // Outdoor
    // =========================
    {
        name: 'Private Garden',
        category: 'Outdoor',
        group: 'Garden',
        description: 'A garden area for exclusive use by a single unit.',
        icon: 'mdiTree',
    },
    {
        name: 'Shared Garden',
        category: 'Outdoor',
        group: 'Garden',
        description: 'A garden area shared among multiple units.',
        icon: 'mdiTreeOutline',
        isPrivate: false,
    },
    {
        name: 'Terrace',
        category: 'Outdoor',
        group: 'Outdoor Space',
        description: 'An open outdoor area, typically located on an upper floor.',
        icon: 'mdiBalcony',
    },
    {
        name: 'Balcony',
        category: 'Outdoor',
        group: 'Outdoor Space',
        description: 'A small elevated outdoor platform attached to a unit.',
        icon: 'mdiBalcony',
    },
    {
        name: 'Rooftop Garden',
        category: 'Outdoor',
        group: 'Garden',
        description: 'A landscaped outdoor area located on a building rooftop.',
        icon: 'mdiSprout',
        isPrivate: false,
    },

    // =========================
    // AMENITIES
    // =========================
    {
        name: 'Swimming Pool',
        category: 'Amenity',
        group: 'Wellness',
        description: 'A shared swimming facility for residents or occupants.',
        icon: 'mdiPool',
        isAssignable: false,
        isPrivate: false,
    },
    {
        name: 'Gym',
        category: 'Amenity',
        group: 'Wellness',
        description: 'A shared fitness facility with exercise equipment.',
        icon: 'mdiDumbbell',
        isAssignable: false,
        isPrivate: false,
    },
    {
        name: 'Spa',
        category: 'Amenity',
        group: 'Wellness',
        description: 'A wellness facility offering relaxation or therapeutic services.',
        icon: 'mdiHotTub',
        isAssignable: false,
        isPrivate: false,
    },
    {
        name: 'Playground',
        category: 'Amenity',
        group: 'Recreation',
        description: 'An outdoor play area designed for children.',
        icon: 'mdiSlide',
        isAssignable: false,
        isPrivate: false,
    },

    // =========================
    // Infrastructure
    // =========================
    {
        name: 'Lobby',
        category: 'Infrastructure',
        group: 'Common Area',
        description: 'The main entrance and reception area of a building.',
        icon: 'mdiDoorOpen',
        isAssignable: false,
        isPrivate: false,
    },
    {
        name: 'Elevator',
        category: 'Infrastructure',
        group: 'Vertical Transport',
        description: 'A mechanical lift used to transport people or goods between floors.',
        icon: 'mdiElevator',
        isAssignable: false,
        isPrivate: false,
    },
    {
        name: 'Staircase',
        category: 'Infrastructure',
        group: 'Vertical Transport',
        description: 'A structural element allowing movement between floors by stairs.',
        icon: 'mdiStairs',
        isAssignable: false,
        isPrivate: false,
    },
    {
        name: 'Electrical Room',
        category: 'Infrastructure',
        group: 'Technical',
        description: 'A technical room housing electrical equipment and panels.',
        icon: 'mdiFlash',
        isAssignable: false,
        isPrivate: false,
    },

    // =========================
    // Land
    // =========================
    {
        name: 'Land Plot',
        category: 'Land',
        group: 'Land',
        description: 'A defined parcel of land intended for development or ownership.',
        icon: 'mdiMap',
        isAssignable: false,
    },
    {
        name: 'Development Parcel',
        category: 'Land',
        group: 'Land',
        description: 'A land area designated for future construction or expansion.',
        icon: 'mdiMapMarkerPath',
        isAssignable: false,
    }
];

export async function createUnitTypes(
    parentLogger: serverLogger,
    company: ICompany,
    categoryIds: Map<string, Types.ObjectId>,
) {
    let logger = getLogger("mongoDbInitialization-createUnitTypes", parentLogger);
    logger.start(`Creating unit types...`);
    await UnitType.bulkWrite(
        defaultUnitTypes.map((u) => {
            const categoryId = categoryIds.get(u.category);
            if (!categoryId) {
                throw new Error(`Missing unit type category seed for "${u.category}"`);
            }
            const {category: _categoryName, ...rest} = u;
            return {
            updateOne: {
                filter: {
                    slug: slugify(u.name, { lower: true }),
                    company: company
                },
                update: {
                    $set: {
                        ...rest,
                        category: categoryId,
                        slug: slugify(u.name, { lower: true }),
                        isPrivate: u.isPrivate ?? true,
                        company: company,
                        createdBy: company.createdBy
                    },
                    // See `unitTypeCategory.defaults.ts`: `auditPlugin` turns on
                    // mongoose timestamps, which already manage both fields on an
                    // upsert. Setting them here too makes mongo reject the batch.
                },
                upsert: true,
            },
        };
        }),
    );
    logger.finish(`Finished creating/updating ${defaultUnitTypes.length} unit types!`);
}
