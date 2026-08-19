import {ObjectId} from "mongodb";
import Floor from "./floor";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {floorsSeed} from "@propertyManagement/database/seeds/hierarchy/floors.seed";

export {floorsSeed as defaultFloors};

/**
 * Seeds the demo floors. Runs after {@link createEdifices}.
 *
 * `totalUnits` is deliberately not seeded — {@link createUnits} recomputes it once the
 * units exist, so the counter can never drift from the rows it counts.
 */
export async function createFloors(
    parentLogger: serverLogger,
    company: ICompany,
    availableMedia: Set<string>,
    edificeIds: Map<string, ObjectId>,
    projectIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createFloors", parentLogger);
    logger.start(`Creating floors (${floorsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of floorsSeed) {
        try {
            const edifice = row.edificeId ? edificeIds.get(row.edificeId) : undefined;
            if (!edifice) {
                logger.warn(`Skipping floor "${row.name}": its edifice was not seeded.`);
                continue;
            }

            const mainImage =
                row.mainImageId && availableMedia.has(row.mainImageId)
                    ? new ObjectId(row.mainImageId)
                    : undefined;
            if (!mainImage) {
                logger.warn(`Skipping floor "${row.name}": its main image was not seeded (field is required).`);
                continue;
            }

            const floorId = new ObjectId(row.id);
            const payload = {
                name: row.name,
                levelNumber: row.levelNumber,
                area: row.area,
                isAccessible: row.isAccessible,
                hasEmergencyExit: row.hasEmergencyExit,
                sharedSpaces: row.sharedSpaces,
                polygonCoordinates: row.polygonCoordinates.map((p) => ({x: p.x, y: p.y})),
                edifice,
                ...(row.projectId && projectIds.get(row.projectId)
                    ? {project: projectIds.get(row.projectId)}
                    : {}),
                mainImage,
                imageGallery: [],
                videoGallery: [],
                mediaFiles: [],
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Floor.findById(floorId);
            if (existing) {
                existing.set(payload);
                await existing.save();
                logger.debug(`Floor "${row.name}" already exists; updated fields`);
            } else {
                await Floor.create({_id: floorId, ...payload});
                logger.debug(`Successfully created floor "${row.name}"`);
            }

            created.set(row.id, floorId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating floor "${row.name}": ${message}`);
        }
    }

    if (created.size === 0) {
        logger.fail("Failed to create floors!");
    } else {
        logger.finish("Finished creating floors!", created.size);
    }

    return created;
}
