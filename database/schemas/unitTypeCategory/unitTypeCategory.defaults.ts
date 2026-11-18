import UnitTypeCategory from "./unitTypeCategory";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {Types} from "mongoose";

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
