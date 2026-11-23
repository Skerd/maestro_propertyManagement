import UnitTypeCategory from "./unitTypeCategory";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {ClientSession, Types} from "mongoose";
import type {SupportedLocale} from "armonia/src/modules/core/constants";
import {unitTypeCategoryService} from "./unitTypeCategory.service";

/**
 * The categories a new property company starts with (TD-B254). A category has one stored name, so it is written in the
 * company's language at creation, and the company renames it like any other.
 */
export const starterUnitTypeCategories = [
    {key: "residential", names: {"en-US": "Residential", "de-CH": "Wohnen", "fr-FR": "Résidentiel", "it-IT": "Residenziale", "sq-AL": "Rezidenciale"}},
    {key: "commercial", names: {"en-US": "Commercial", "de-CH": "Gewerbe", "fr-FR": "Commerce", "it-IT": "Commerciale", "sq-AL": "Komerciale"}},
] as const satisfies readonly {key: string; names: Record<SupportedLocale, string>}[];

export type StarterUnitTypeCategoryKey = (typeof starterUnitTypeCategories)[number]["key"];

/**
 * Adds the starter categories the company does not have yet, found by their name in `locale` (deleted rows count: the
 * name stays unique per company), and returns each one's id by key.
 */
export async function createStarterUnitTypeCategories(
    company: ICompany,
    locale: SupportedLocale,
    {session, logger}: {session: ClientSession; logger: serverLogger},
): Promise<Map<StarterUnitTypeCategoryKey, Types.ObjectId>> {
    const ids = new Map<StarterUnitTypeCategoryKey, Types.ObjectId>();
    const auditUserId = company.createdBy?._id;
    for (const {key, names} of starterUnitTypeCategories) {
        const name = names[locale];
        const existing = await unitTypeCategoryService.findOne({company: company._id, name}, {session, logger, withDeleted: true}, undefined, "_id");
        const category = existing ?? await unitTypeCategoryService.create({name, company: company._id}, {session, logger, auditUserId});
        ids.set(key, category._id);
    }
    return ids;
}

/** Category names read as words on cards ("Category: Residential"), not like codes (UX-09, TD-B247). */
export const defaultUnitTypeCategoryNames = [
    "Residential",
    "Commercial",
    "Parking",
    "Storage",
    "Outdoor",
    "Amenity",
    "Infrastructure",
    "Land",
] as const;

export async function createUnitTypeCategories(parentLogger: serverLogger, company: ICompany): Promise<Map<string, Types.ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createUnitTypeCategories", parentLogger);
    logger.start("Creating unit type categories...");
    const categoryIds = new Map<string, Types.ObjectId>();

    await UnitTypeCategory.bulkWrite(
        defaultUnitTypeCategoryNames.map((name) => ({
            updateOne: {
                // Matched regardless of case, so a database seeded with "RESIDENTIAL" gets its row renamed, not a second one.
                filter: {name, company},
                collation: {locale: "en", strength: 2},
                update: {
                    $set: {
                        name,
                        company,
                        createdBy: company.createdBy,
                    },
                    // No manual createdAt/updatedAt: `auditPlugin` sets
                    // `timestamps: true`, so mongoose already adds `updatedAt`
                    // to `$set` and `createdAt` to `$setOnInsert` on an upsert.
                    // Setting them here too makes mongo reject the whole batch
                    // with "Updating the path 'updatedAt' would create a
                    // conflict at 'updatedAt'".
                },
                upsert: true,
            },
        })),
    );

    const categories = await UnitTypeCategory.find({company: company._id, name: {$in: [...defaultUnitTypeCategoryNames]}});
    for (const category of categories) {
        categoryIds.set(category.name, category._id);
    }

    logger.finish(`Finished creating/updating ${categoryIds.size} unit type categories!`);
    return categoryIds;
}
