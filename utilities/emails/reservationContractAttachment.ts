/**
 * Load reservation contract media from GridFS for email attachments (bounded size).
 */

import {ObjectId} from "mongodb";
import {mediaService} from "@coreModule/database/schemas/media/media.service";
import {getGridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";

/** Many SMTP providers reject very large messages; skip attachment above this size. */
const MAX_CONTRACT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type ReservationContractAttachment = {
    filename: string;
    content: Buffer;
    contentType: string;
};

export async function tryLoadReservationContractForEmail(
    mediaId: string | undefined,
    languageCode: string
): Promise<ReservationContractAttachment | null> {
    if (!mediaId || !ObjectId.isValid(mediaId)) {
        return null;
    }

    try {
        const media = await mediaService.findById(new ObjectId(mediaId), {languageCode});
        if (!media?.fileId) {
            return null;
        }

        const gridfs = getGridFSStorage(languageCode, "media");
        const fileId = media.fileId instanceof ObjectId ? media.fileId : new ObjectId(media.fileId.toString());
        const buffer = await gridfs.getFileBuffer(fileId);

        if (!buffer.length || buffer.length > MAX_CONTRACT_ATTACHMENT_BYTES) {
            return null;
        }

        const mimeType = media.mimeType || media.metadata?.mime || "application/octet-stream";
        const base =
            media.originalName?.trim() ||
            media.fileName?.trim() ||
            `reservation-contract-${mediaId.slice(-8)}`;
        const safeName = base.replace(/[/\\<>:"|?*]/g, "_").slice(0, 180) || "reservation-contract";

        return {
            filename: safeName,
            content: buffer,
            contentType: mimeType,
        };
    } catch {
        return null;
    }
}
