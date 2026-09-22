/**
 * Load image media from GridFS as inline (cid) email attachments, bounded in count and total size
 * so the message stays deliverable. Images are attached rather than linked because the public media
 * route resolves the company from the request origin, which a mail client does not send.
 */

import {ObjectId} from "mongodb";
import {mediaService} from "@coreModule/database/schemas/media/media.service";
import {getGridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";

export const MAX_EMAIL_IMAGES = 6;
/** Per-message budget for all images together (many SMTP providers cap messages near 20–25 MB). */
export const MAX_EMAIL_IMAGES_TOTAL_BYTES = 15 * 1024 * 1024;

export type InlineImageAttachment = {
    filename: string;
    content: Buffer;
    contentType: string;
    cid: string;
};

type LoadOptions = {languageCode: string; maxImages?: number; maxTotalBytes?: number; cidPrefix?: string};

export async function loadInlineImageAttachments(mediaIds: unknown[], opts: LoadOptions): Promise<InlineImageAttachment[]> {
    const maxImages = opts.maxImages ?? MAX_EMAIL_IMAGES;
    const budget = opts.maxTotalBytes ?? MAX_EMAIL_IMAGES_TOTAL_BYTES;
    const prefix = opts.cidPrefix ?? "photo";
    const out: InlineImageAttachment[] = [];
    let total = 0;

    for (const raw of mediaIds) {
        if (out.length >= maxImages) break;
        const id = raw instanceof ObjectId ? raw : (raw as {_id?: unknown})?._id ?? raw;
        if (!id || !ObjectId.isValid(String(id))) continue;
        try {
            const media = await mediaService.findById(new ObjectId(String(id)), {languageCode: opts.languageCode});
            const mimeType = media?.mimeType || media?.metadata?.mime || "";
            if (!media?.fileId || !String(mimeType).startsWith("image/")) continue;
            // Skip before downloading when the stored size already busts the budget.
            if (media.sizeInBytes && total + media.sizeInBytes > budget) continue;

            const gridfs = getGridFSStorage(opts.languageCode, "media");
            const fileId = media.fileId instanceof ObjectId ? media.fileId : new ObjectId(media.fileId.toString());
            const buffer = await gridfs.getFileBuffer(fileId);
            if (!buffer.length || total + buffer.length > budget) continue;

            total += buffer.length;
            const base = media.originalName?.trim() || media.fileName?.trim() || `${prefix}-${out.length + 1}`;
            out.push({
                filename: base.replace(/[/\\<>:"|?*]/g, "_").slice(0, 180),
                content: buffer,
                contentType: String(mimeType),
                cid: `${prefix}-${out.length + 1}-${String(id).slice(-8)}@arpeggio`,
            });
        } catch {
            // Best-effort: a missing or unreadable photo never blocks the email.
        }
    }
    return out;
}
