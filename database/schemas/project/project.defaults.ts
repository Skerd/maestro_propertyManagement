import {Decimal128, ObjectId} from "mongodb";
import Project from "./project";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {projectsSeed} from "@propertyManagement/database/seeds/hierarchy/projects.seed";

export {projectsSeed as defaultProjects};

/**
 * Seeds the demo projects exported from the reference estate.
 *
 * Idempotent on the preserved `_id`: the hierarchy is self-contained, so keeping the
 * original ids is what lets edifices/floors/units and their images point at the right
 * rows without any remapping.
 *
 * @param availableMedia ids of `Media` documents that actually exist — a `mainImage`
 *        is only set when its binary was seeded, since the field is required and a
 *        dangling ref would break the panel.
 */
export async function createProjects(
    parentLogger: serverLogger,
    company: ICompany,
    availableMedia: Set<string>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createProjects", parentLogger);
    logger.start(`Creating projects (${projectsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of projectsSeed) {
        try {
            const projectId = new ObjectId(row.id);
            const mainImage =
                row.mainImageId && availableMedia.has(row.mainImageId)
                    ? new ObjectId(row.mainImageId)
                    : undefined;

            if (!mainImage) {
                logger.warn(`Skipping project "${row.name}": its main image was not seeded (field is required).`);
                continue;
            }

            const payload = {
                name: row.name,
                description: row.description,
                saleCommissionRatePercent: row.saleCommissionRatePercent
                    ? Decimal128.fromString(row.saleCommissionRatePercent)
                    : undefined,
                reservationCommissionRatePercent: row.reservationCommissionRatePercent
                    ? Decimal128.fromString(row.reservationCommissionRatePercent)
                    : undefined,
                featuredOnHomepage: row.featuredOnHomepage,
                featuredSortOrder: row.featuredSortOrder,
                magazineTitle: row.magazineTitle,
                magazineDescription: row.magazineDescription,
                socialLinks: row.socialLinks.map((link) => ({name: link.name, link: link.link})),
                mainImage,
                imageGallery: [],
                videoGallery: [],
                mediaFiles: [],
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Project.findById(projectId);
            if (existing) {
                existing.set(payload);
                await existing.save();
                logger.debug(`Project "${row.name}" already exists; updated fields`);
            } else {
                await Project.create({_id: projectId, ...payload});
                logger.debug(`Successfully created project "${row.name}"`);
            }

            created.set(row.id, projectId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating project "${row.name}": ${message}`);
        }
    }

    if (created.size === 0) {
        logger.fail("Failed to create projects!");
    } else {
        logger.finish("Finished creating projects!", created.size);
    }

    return created;
}
