import {ObjectId} from "mongodb";
import ConstructionUpdate from "./constructionUpdate";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {constructionUpdatesSeed} from "@propertyManagement/database/seeds/operations/constructionUpdates.seed";
import {opt} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {constructionUpdatesSeed as defaultConstructionUpdates};

/** Seeds the build-progress timeline shown on the public project pages. */
export async function createConstructionUpdates(
    parentLogger: serverLogger,
    company: ICompany,
    projectIds: Map<string, ObjectId>,
    edificeIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createConstructionUpdates", parentLogger);
    logger.start(`Creating construction updates (${constructionUpdatesSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of constructionUpdatesSeed) {
        try {
            const project = projectIds.get(row.project);
            if (!project) {
                logger.warn(`Skipping construction update "${row.title}": its project was not seeded.`);
                continue;
            }

            const updateId = new ObjectId(row.id);
            const payload = {
                project,
                ...opt("edifice", edificeIds.get(row.edifice)),
                title: row.title,
                description: row.description,
                progressPercent: row.progressPercent,
                updateDate: new Date(row.updateDate),
                photos: [],
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await ConstructionUpdate.findById(updateId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await ConstructionUpdate.create({_id: updateId, ...payload});
            }

            created.set(row.id, updateId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating construction update "${row.title}": ${message}`);
        }
    }

    logger.finish("Finished creating construction updates!", created.size);
    return created;
}
