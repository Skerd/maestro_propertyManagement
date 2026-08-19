/**
 * Re-creates the `Media` document backing the seeded stories.
 *
 * `Story.mainImage` points at an asset that is not part of the hierarchy media set,
 * so it ships separately — but the binary lives in `../hierarchy/media/` alongside the
 * rest, and the row shape is the hierarchy's, so this reuses that loader wholesale.
 */

import fs from "fs";
import path from "path";
import {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import Media from "@coreModule/database/schemas/media/media";
import {createGridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";
import {storyMediaSeed} from "./storyMedia.seed";

const ASSET_DIR = path.resolve(__dirname, "..", "hierarchy", "media");

/** @returns the set of `Media._id`s that exist afterwards. */
export async function createStoryMedia(
    parentLogger: serverLogger,
    company: ICompany,
): Promise<Set<string>> {
    const logger = getLogger("mongoDbInitialization-createStoryMedia", parentLogger);
    logger.start(`Creating story media (${storyMediaSeed.length} assets)...`);

    const available = new Set<string>();

    if (!fs.existsSync(ASSET_DIR)) {
        logger.warn(`Story media directory missing: ${ASSET_DIR}. Seeding without images.`);
        logger.finish("Finished creating story media!");
        return available;
    }

    const gridfs = createGridFSStorage("en-US", "media", logger);

    for (const row of storyMediaSeed) {
        try {
            const mediaId = new ObjectId(row.mediaId);

            const existing = await Media.findById(mediaId).select("_id");
            if (existing) {
                available.add(row.mediaId);
                continue;
            }

            const assetPath = path.join(ASSET_DIR, row.assetFile);
            if (!fs.existsSync(assetPath)) {
                logger.warn(`Missing story asset ${row.assetFile} for media ${row.mediaId}; skipping.`);
                continue;
            }

            const buffer = await fs.promises.readFile(assetPath);
            const fileId = await gridfs.uploadFile(buffer, row.fileName, {
                company: String(company._id),
                source: "property-story-seed",
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
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.err(`Error creating story media ${row.mediaId} (${row.fileName}): ${message}`);
        }
    }

    logger.finish("Finished creating story media!", available.size);
    return available;
}
