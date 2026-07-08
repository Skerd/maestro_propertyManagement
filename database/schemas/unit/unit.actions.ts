import {ObjectId} from 'mongodb';
import {z} from 'zod';
import {action} from '@coreModule/api/actionDecorator';
import {apiValidationException} from 'armonia/src/modules/core/helpers/exceptions';
import {createGridFSStorage} from '@coreModule/utilities/gridfs/gridfsStorage';
import {mediaService} from '@coreModule/database/schemas/media/media.service';
import {unitService} from './unit.service';
import {floorService} from '../floor/floor.service';
import {edificeService} from '../edifice/edifice.service';
import {projectService} from '../project/project.service';
import {PDFDocument} from 'pdf-lib';

function generateMarketingBookletSchema() {
    return z.object({unitId: z.string().min(1)});
}

export class UnitActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        schema: (_lang, _form) => generateMarketingBookletSchema(),
    })
    async generateMarketingBooklet(params: any, _queryParams: any, _req: any, res: any): Promise<void> {
        const {unitId, company, logger, languageCode} = params;

        logger.start(`Generating marketing booklet for unit ${unitId}...`);

        const unit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unitId), company: company._id},
            {logger, languageCode},
            undefined,
            "marketingBooklet floor edifice project"
        );

        const floorId   = unit.floor;
        const edificeId = unit.edifice;
        const projectId = unit.project;

        const [floor, edifice, project] = await Promise.all([
            floorId
                ? floorService.findByIdOrThrow(floorId._id, {logger, languageCode}, undefined, "marketingBooklet")
                : null,
            edificeId
                ? edificeService.findByIdOrThrow(edificeId, {logger, languageCode}, undefined, "marketingBooklet")
                : null,
            projectId
                ? projectService.findByIdOrThrow(projectId, {logger, languageCode}, undefined, "marketingBooklet")
                : null,
        ]);

        // Collect booklet MediaIds in order: project → edifice → floor → unit
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
            const mediaId = rawId instanceof ObjectId ? rawId : new ObjectId(String(rawId));
            const media = await mediaService.findByIdOrThrow(mediaId, {logger, languageCode, withDeleted: true});
            if (!media?.fileId) continue;
            const fileId = media.fileId instanceof ObjectId ? media.fileId : new ObjectId(String(media.fileId));
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
            pages.forEach(page => mergedPdf.addPage(page));
        }

        const merged = Buffer.from(await mergedPdf.save());
        const unitLabel = unit.unitNumber ?? unit.name ?? unitId;
        const filename = `marketing-booklet-${unitLabel}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader("Content-Length", merged.length);
        res.send(merged);

        logger.finish(`Marketing booklet generated for unit ${unitId}`);
    }
}
