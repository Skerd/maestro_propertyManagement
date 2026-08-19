/**
 * Re-creates the `Media` documents the exported hierarchy references, uploading the
 * checked-in binaries from `./media/` into GridFS.
 *
 * `Media._id` is preserved from the export — that is the id the project/edifice/floor/
 * unit seeds point at. The GridFS `fileId` is new on every run and does not matter,
 * because nothing outside `Media` references it.
 */

import fs from "fs";
import path from "path";
import {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import Media from "@coreModule/database/schemas/media/media";
import {createGridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";
import {mediaSeed} from "./media.seed";

const ASSET_DIR = path.resolve(__dirname, "media");

/**
 * Seeds hierarchy media for a company.
 *
 * @returns the set of `Media._id`s that exist afterwards, so the hierarchy seeders
 *          can drop `mainImage` references whose binary was not available.
 */
export async function createHierarchyMedia(
    parentLogger: serverLogger,
    company: ICompany,
): Promise<Set<string>> {
    const logger = getLogger("mongoDbInitialization-createHierarchyMedia", parentLogger);
    logger.start(`Creating property hierarchy media (${mediaSeed.length} assets)...`);

    const available = new Set<string>();

    if (!fs.existsSync(ASSET_DIR)) {
        logger.warn(`Hierarchy media directory missing: ${ASSET_DIR}. Seeding without images.`);
        logger.finish("Finished creating property hierarchy media!");
        return available;
    }

    const gridfs = createGridFSStorage("en-US", "media", logger);
    let created = 0;
    let reused = 0;
    let skipped = 0;

    for (const row of mediaSeed) {
        try {
            const mediaId = new ObjectId(row.mediaId);

            const existing = await Media.findById(mediaId).select("_id");
            if (existing) {
                available.add(row.mediaId);
                reused += 1;
                continue;
            }

            const assetPath = path.join(ASSET_DIR, row.assetFile);
            if (!fs.existsSync(assetPath)) {
                logger.warn(`Missing hierarchy asset ${row.assetFile} for media ${row.mediaId}; skipping.`);
                skipped += 1;
                continue;
            }

            const buffer = await fs.promises.readFile(assetPath);
            const fileId = await gridfs.uploadFile(buffer, row.fileName, {
                company: String(company._id),
                source: "property-hierarchy-seed",
                mediaId: row.mediaId,
            });

            await Media.create({
                _id: mediaId,
                type: row.type,
                originalName: row.fileName,
                fileName: row.fileName,
                fileId,
                mimeType: row.mimeType,
                extension: row.extension,
                fileSize: buffer.length,
                sizeInBytes: buffer.length,
                metadata: {
                    size: buffer.length,
                    extension: row.extension,
                    mime: row.mimeType,
                    safeCheckedFlag: true,
                    scannedAt: new Date(),
                    scannerResult: "Seeded asset — scan skipped",
                    ...(row.resolution ? {resolution: row.resolution} : {}),
                },
                ...(row.resolution ? {resolution: row.resolution} : {}),
                company: company._id,
                createdBy: company.createdBy,
                uploadedAt: new Date(),
            });

            available.add(row.mediaId);
            created += 1;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.err(`Error creating hierarchy media ${row.mediaId} (${row.fileName}): ${message}`);
            skipped += 1;
        }
    }

    logger.finish(
        `Finished creating property hierarchy media! (${created} new, ${reused} existing, ${skipped} skipped)`,
    );
    return available;
}
