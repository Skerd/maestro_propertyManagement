import {ObjectId} from "mongodb";
import Story from "./story";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {storiesSeed} from "@propertyManagement/database/seeds/operations/stories.seed";
import {storyMainImageByStoryId} from "@propertyManagement/database/seeds/operations/storyMedia.seed";

export {storiesSeed as defaultStories};

/**
 * Seeds the marketing stories attached to a project.
 *
 * `name` is authored here (not auto-generated as on the other operations models), so it
 * is preserved. One exported story predates `storyType` becoming required and carries
 * none; rather than drop it, it falls back to the first seeded type.
 */
export async function createStories(
    parentLogger: serverLogger,
    company: ICompany,
    projectIds: Map<string, ObjectId>,
    storyTypeIdsBySlug: Map<string, ObjectId>,
    availableMedia: Set<string>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createStories", parentLogger);
    logger.start(`Creating stories (${storiesSeed.length})...`);

    const fallbackStoryType = storyTypeIdsBySlug.values().next().value as ObjectId | undefined;
    const created = new Map<string, ObjectId>();

    for (const row of storiesSeed) {
        try {
            const project = projectIds.get(row.project);
            if (!project) {
                logger.warn(`Skipping story "${row.name}": its project was not seeded.`);
                continue;
            }

            const storyType = row.storyType
                ? storyTypeIdsBySlug.get(row.storyType.$storyType)
                : fallbackStoryType;
            if (!storyType) {
                logger.warn(`Skipping story "${row.name}": no story type available.`);
                continue;
            }

            const mainImageId = storyMainImageByStoryId[row.id];
            const mainImage =
                mainImageId && availableMedia.has(mainImageId) ? new ObjectId(mainImageId) : undefined;

            const storyId = new ObjectId(row.id);
            const payload = {
                name: row.name,
                project,
                storyType,
                title: row.title,
                content: row.content,
                excerpt: row.excerpt,
                ...(mainImage ? {mainImage} : {}),
                imageGallery: [],
                videoGallery: [],
                published: row.published,
                publishedAt: new Date(row.publishedAt),
                sortOrder: row.sortOrder,
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Story.findById(storyId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Story.create({_id: storyId, ...payload});
            }

            created.set(row.id, storyId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating story "${row.name}": ${message}`);
        }
    }

    logger.finish("Finished creating stories!", created.size);
    return created;
}
