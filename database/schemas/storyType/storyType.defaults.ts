import {ObjectId} from "mongodb";
import StoryType from "./storyType";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {storyTypesSeed} from "@propertyManagement/database/seeds/operations/storyTypes.seed";

export {storyTypesSeed as defaultStoryTypes};

/**
 * Seeds the story categories.
 *
 * Unlike the rest of the operations seeds, `name` here is authored rather than
 * auto-generated, so it is preserved — and `name`/`slug` are both globally unique, so a
 * pre-existing document under the same slug is adopted rather than duplicated.
 *
 * @returns slug → `StoryType._id`, which is how the story seeds reference their type.
 */
export async function createStoryTypes(
    parentLogger: serverLogger,
    company: ICompany,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createStoryTypes", parentLogger);
    logger.start(`Creating story types (${storyTypesSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of storyTypesSeed) {
        try {
            const storyTypeId = new ObjectId(row.id);
            const payload = {
                name: row.name,
                slug: row.slug,
                description: row.description,
                sortOrder: row.sortOrder,
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing =
                (await StoryType.findById(storyTypeId)) ?? (await StoryType.findOne({slug: row.slug}));
            if (existing) {
                existing.set(payload);
                await existing.save();
                created.set(row.slug, existing._id as ObjectId);
                continue;
            }

            await StoryType.create({_id: storyTypeId, ...payload});
            created.set(row.slug, storyTypeId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating story type "${row.slug}": ${message}`);
        }
    }

    logger.finish("Finished creating story types!", created.size);
    return created;
}
