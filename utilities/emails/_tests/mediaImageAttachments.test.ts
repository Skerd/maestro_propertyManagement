import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const store = vi.hoisted(() => ({media: new Map<string, any>(), files: new Map<string, Buffer>()}));

vi.mock("@coreModule/database/schemas/media/media.service", () => ({
    mediaService: {findById: async (id: ObjectId) => store.media.get(id.toString()) ?? null},
}));
vi.mock("@coreModule/utilities/gridfs/gridfsStorage", () => ({
    getGridFSStorage: () => ({getFileBuffer: async (fileId: ObjectId) => store.files.get(fileId.toString()) ?? Buffer.alloc(0)}),
}));

import {loadInlineImageAttachments} from "../mediaImageAttachments";

function addMedia(opts: {mime?: string; size: number; name?: string}): ObjectId {
    const id = new ObjectId();
    const fileId = new ObjectId();
    store.media.set(id.toString(), {fileId, mimeType: opts.mime ?? "image/jpeg", sizeInBytes: opts.size, originalName: opts.name ?? "p.jpg"});
    store.files.set(fileId.toString(), Buffer.alloc(opts.size, 1));
    return id;
}

describe("loadInlineImageAttachments", () => {
    beforeEach(() => {
        store.media.clear();
        store.files.clear();
    });

    it("keeps images within the count limit and gives each a unique cid", async () => {
        const ids = Array.from({length: 8}, () => addMedia({size: 10}));
        const out = await loadInlineImageAttachments(ids, {languageCode: "en-US", maxImages: 6});
        expect(out).toHaveLength(6);
        expect(new Set(out.map(o => o.cid)).size).toBe(6);
    });

    it("skips non-images, missing media and anything over the size budget", async () => {
        const pdf = addMedia({mime: "application/pdf", size: 10});
        const big = addMedia({size: 90});
        const ok1 = addMedia({size: 40});
        const ok2 = addMedia({size: 50});
        const out = await loadInlineImageAttachments([pdf, new ObjectId(), big, ok1, "not-an-id", ok2], {languageCode: "en-US", maxTotalBytes: 100});
        expect(out.map(o => o.content.length)).toEqual([90]);

        const out2 = await loadInlineImageAttachments([ok1, big, ok2], {languageCode: "en-US", maxTotalBytes: 100});
        expect(out2.map(o => o.content.length)).toEqual([40, 50]);
    });
});
