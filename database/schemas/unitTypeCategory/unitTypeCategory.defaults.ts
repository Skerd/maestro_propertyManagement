import UnitTypeCategory from "./unitTypeCategory";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {Types} from "mongoose";

export const defaultUnitTypeCategoryNames = [
    "RESIDENTIAL",
    "COMMERCIAL",
    "PARKING",
    "STORAGE",
    "OUTDOOR",
    "AMENITY",
    "INFRASTRUCTURE",
    "LAND",
] as const;

export async function createUnitTypeCategories(parentLogger: serverLogger, company: ICompany): Promise<Map<string, Types.ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createUnitTypeCategories", parentLogger);
    logger.start("Creating unit type categories...");
    const categoryIds = new Map<string, Types.ObjectId>();

    await UnitTypeCategory.bulkWrite(
        defaultUnitTypeCategoryNames.map((name) => ({
            updateOne: {
                filter: {name, company},
                update: {
                    $set: {
                        name,
                        company,
                        createdBy: company.createdBy,
                    },
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
