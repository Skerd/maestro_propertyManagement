import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {createGridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";
import {mediaService} from "@coreModule/database/schemas/media/media.service";
import {unitService} from "../../database/schemas/unit/unit.service";
import {floorService} from "../../database/schemas/floor/floor.service";
import {edificeService} from "../../database/schemas/edifice/edifice.service";
import {projectService} from "../../database/schemas/project/project.service";
import {PDFDocument} from "pdf-lib";
import {serverLogger} from "@coreModule/loggers/serverLog";

type BuildMarketingBookletParams = {
    unitId: ObjectId;
    companyId: ObjectId;
    languageCode: string;
    logger: serverLogger;
    /** When set, unit must belong to this project. */
    projectId?: ObjectId;
};

export type MarketingBookletPdf = {
    buffer: Buffer;
    filename: string;
};

function toObjectId(value: unknown): ObjectId | null {
    if (!value) return null;
    if (value instanceof ObjectId) return value;
    const id = (value as {_id?: unknown})?._id ?? value;
    if (!id) return null;
    try {
        return id instanceof ObjectId ? id : new ObjectId(String(id));
    } catch {
        return null;
    }
}

/** Merges project → edifice → floor → unit marketing booklet PDFs for a unit. */
export async function buildUnitMarketingBookletPdf(
    params: BuildMarketingBookletParams,
): Promise<MarketingBookletPdf> {
    const {unitId, companyId, languageCode, logger, projectId} = params;
    const opts = {logger, languageCode};

    const unit = await unitService.findOneOrThrow(
        {_id: unitId, company: companyId, deletedAt: null},
        opts,
        undefined,
        "marketingBooklet floor edifice project",
    );

    const unitProjectId = toObjectId(unit.project);
    if (projectId && unitProjectId && !unitProjectId.equals(projectId)) {
        throw apiValidationException("unit_not_found", "unitId", [unitId?.toString()], languageCode);
    }

    const floorId = toObjectId(unit.floor);
    const edificeId = toObjectId(unit.edifice);
    const resolvedProjectId = unitProjectId;

    const [floor, edifice, project] = await Promise.all([
        floorId
            ? floorService.findByIdOrThrow(floorId, opts, undefined, "marketingBooklet")
            : null,
        edificeId
            ? edificeService.findByIdOrThrow(edificeId, opts, undefined, "marketingBooklet")
            : null,
        resolvedProjectId
            ? projectService.findByIdOrThrow(resolvedProjectId, opts, undefined, "marketingBooklet")
            : null,
    ]);

    const rawIds = [
        project?.marketingBooklet,
        edifice?.marketingBooklet,
        floor?.marketingBooklet,
        unit?.marketingBooklet,
    ].filter(Boolean);

    if (rawIds.length === 0) {
        throw apiValidationException("no_marketing_booklet", null, null, languageCode);
    }

    const gridfs = createGridFSStorage(languageCode, "media", logger);
    const buffers: Buffer[] = [];

    for (const rawId of rawIds) {
        const mediaId = toObjectId(rawId);
        if (!mediaId) continue;
        const media = await mediaService.findByIdOrThrow(mediaId, {...opts, withDeleted: true});
        if (!media?.fileId) continue;
        const fileId = toObjectId(media.fileId);
        if (!fileId) continue;
        try {
            buffers.push(await gridfs.getFileBuffer(fileId));
        } catch {
            logger.warn(`Skipping booklet ${mediaId}: file missing in GridFS`);
        }
    }

    if (buffers.length === 0) {
        throw apiValidationException("no_marketing_booklet", null, null, languageCode);
    }

    const mergedPdf = await PDFDocument.create();
    for (const buffer of buffers) {
        const src = await PDFDocument.load(buffer);
        const pages = await mergedPdf.copyPages(src, src.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
    }

    const buffer = Buffer.from(await mergedPdf.save());
    const unitLabel = unit.unitNumber ?? unit.name ?? String(unitId);
    const filename = `marketing-booklet-${unitLabel}.pdf`;

    return {buffer, filename};
}
