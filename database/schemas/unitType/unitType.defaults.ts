import UnitType from "./unitType";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import slugify from "slugify";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {Types} from "mongoose";

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
