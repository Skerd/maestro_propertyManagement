import fs from 'fs';
import path from 'path';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from '../config';
import {ensureDir} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/fileUtils';
import {cropByRectangles} from './rectangleCroppingUtils';
import type {PageImageResult} from '../types';
import {execFileSync} from "child_process";
import {
    boostImageMaxInMemory,
    detectImageLines, rotationNeededToLandscapeTheImage
} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/imageUtils";

/**
 * Batch processes multiple PDF pages efficiently
 */
export async function batchRenderAndProcessPages(
    inputPath: string,
    pdfDoc: PDFDocument,
    parentLogger: serverLogger,
    pageIndices: number[],
    outputRoot: string,
    timer: PerformanceTimer,
    pageCount: number,
): Promise<PageImageResult[]> {
    return await timer.timeAsync('batchRenderAndProcessPages', async () => {
        const logger = getLogger("batch_render_and_process", parentLogger);
        logger.start(`Batch processing ${pageIndices.length} pages...`);

        if (pageIndices.length === 0) {
            logger.finish("No page indices to process, received 0 indices, returning empty result");
            return [];
        }

        const firstPage = pageIndices[0] + 1;
        const lastPage = pageIndices[pageIndices.length - 1] + 1;

        // Create temp directory for batch output
        const tempDir = path.join(outputRoot, '_temp_batch');
        ensureDir(tempDir, logger);

        logger.debug(`Batch rendering pages ${firstPage}-${lastPage} out of ${pageCount} pages...`);
        const outputPattern = 'page-%d.png';
        const pageToPath = timer.timeSync('turnPdfPageToImage', () => {
            const batchRenderingLogger = getLogger("render_pages_batch_ghostscript", logger);
            batchRenderingLogger.start(`Batch rendering pages ${firstPage}-${lastPage} using Ghostscript`);
            const flags = [
                '-dNOPAUSE',
                '-dBATCH',
                '-dSAFER',
                '-q',
                '-dNumRenderingThreads=4',         // Enable multithreading (optimal per Ghostscript docs)
                '-dMaxBitmap=500000000',           // Optimize memory (500MB)
                '-dBufferSpace=16777216',          // 16MB buffer (optimal per docs)
                `-sDEVICE=png16m`,                 // 24-bit PNG (faster than pngalpha, no alpha needed)
                `-r${config.BATCH_PDF_PAGES_DPI}`,
                `-dFirstPage=${firstPage}`,
                `-dLastPage=${lastPage}`,
                '-dNOINTERPOLATE',
                '-dGraphicsAlphaBits=1',
                '-dTextAlphaBits=1',
                '-dUseFastColor=true',
                '-dCOLORSCREEN=false',
                '-dUseCropBox',
                '-dNOCIE',
                `-sOutputFile=${path.join(tempDir, outputPattern)}`,
                inputPath
            ];
            execFileSync('gs', flags, { stdio: 'ignore' });
            const pageToPath = new Map<number, string>();
            for (let page = firstPage; page <= lastPage; page++) {
                const iteration = page - firstPage + 1;
                const filePath = path.join(tempDir, outputPattern.replace("%d", String(iteration)));
                if (fs.existsSync(filePath)) {
                    pageToPath.set(page, filePath);
                }
                else {
                    batchRenderingLogger.warn(`Batch rendered file missing for page ${page}: ${filePath}`);
                }
            }
            batchRenderingLogger.finish(`Finished batch rendering ${lastPage - firstPage + 1} pages! Found ${pageToPath.size}/${lastPage - firstPage + 1} files.`);
            return pageToPath;
        });
        logger.debug("Finished batch rendering!");

        // Batch-render all pages at high detail DPI in one GS call (replaces N per-page GS calls)
        let detailTempDir = path.join(outputRoot, '_temp_detail_batch');
        ensureDir(detailTempDir, logger);

        logger.debug(`Batch detail rendering pages ${firstPage}-${lastPage} @ ${config.DETAIL_PDF_PAGES_DPI} DPI...`);
        const detailedImageOutputPattern = 'detail-%d.png';
        const detailPageToPath = timer.timeSync('turnPDFPageToDetailedImage', () => {
            const detailBatchRenderingLogger = getLogger('render_detail_pages_batch_ghostscript', logger);
            detailBatchRenderingLogger.start(`Batch detail rendering pages ${firstPage}-${lastPage} @ ${config.DETAIL_PDF_PAGES_DPI} DPI`);

            const outputPath = path.join(detailTempDir, detailedImageOutputPattern);
            const flags = [
                '-dNOPAUSE',
                '-dBATCH',
                '-dSAFER',
                '-q',
                '-dNumRenderingThreads=4',
                '-dMaxBitmap=500000000',
                '-dBufferSpace=16777216',
                '-sDEVICE=png16m',
                `-r${config.DETAIL_PDF_PAGES_DPI}`,
                `-dFirstPage=${firstPage}`,
                `-dLastPage=${lastPage}`,
                '-dUseCropBox',
                `-sOutputFile=${outputPath}`,
                inputPath,
            ];
            execFileSync('gs', flags, { stdio: 'ignore' });
            const pageToPath = new Map<number, string>();
            let iteration = 1;
            for (let page = firstPage; page <= lastPage; page++) {
                pageToPath.set(page, path.join(detailTempDir, detailedImageOutputPattern.replace('%d', String(iteration))));
                iteration++;
            }

            let found = 0;
            for (const [, fp] of pageToPath) if (fs.existsSync(fp)) found++;

            detailBatchRenderingLogger.finish(`Finished batch detail rendering ${lastPage - firstPage + 1} pages! Found ${pageToPath.size}/${lastPage - firstPage + 1} files.`);
            return pageToPath;
        });
        logger.debug("Finished batch detail rendering!");

        const results: PageImageResult[] = [];

        // Process each rendered page
        for (const pageIndex of pageIndices) {
            const pageNumber = pageIndex + 1;
            const tempPagePath = pageToPath.get(pageNumber);
            const detailedTempPagePath = detailPageToPath.get(pageNumber);

            logger.debug(`Using batch rendered file for page ${pageNumber}`);

            // Move to final location and process
            const pageFolder = path.join(outputRoot, `page-${pageNumber}`);
            ensureDir(pageFolder, logger);
            const outputPath = path.join(pageFolder, `page-${pageNumber}.png`);
            
            // Get page attributes before processing
            const page = pdfDoc.getPage(pageIndex);
            const isRotated = Math.abs(page.getRotation().angle) % 180 !== 0;
            const displayWidth = isRotated ? page.getHeight() : page.getWidth();
            const displayHeight = isRotated ? page.getWidth() : page.getHeight();

            let renderedImageBuffer: Buffer = await sharp(tempPagePath).png().toBuffer();
            let imageInfo = await sharp(renderedImageBuffer).metadata();

            // now we check if the image needs rotating to be in landscape mode
            const rotationNeeded = rotationNeededToLandscapeTheImage(imageInfo.width, imageInfo.height, displayWidth, displayHeight, config.BATCH_PDF_PAGES_DPI);
            if (rotationNeeded !== 0) {
                renderedImageBuffer = await sharp(renderedImageBuffer).rotate(rotationNeeded).png().toBuffer();
                await sharp(renderedImageBuffer).png().toFile(outputPath);
                imageInfo = await sharp(renderedImageBuffer).metadata();
                // Delete temp file after rotation
                fs.unlinkSync(tempPagePath);
            }
            else {
                // No rotation needed, just move the file
                fs.renameSync(tempPagePath, outputPath);
            }
            logger.debug(`Image dimensions: ${imageInfo.width}x${imageInfo.height}`);

            // Pass the already-in-memory buffer to avoid a redundant disk read in boost
            let boostedBuffer: Buffer = await boostImageMaxInMemory(renderedImageBuffer, logger, timer, path.join(pageFolder, `page-${pageNumber}-boosted.png`));
            // Detect lines using the boosted image
            const detection = await detectImageLines(boostedBuffer, path.join(pageFolder, `page-${pageNumber}-lines.png`), logger, timer);

            // Read pre-rendered detail buffer for this page.
            // Apply the same landscape rotation as the preview so crop coords align.
            let detailPipeline = sharp(detailedTempPagePath);
            if (rotationNeeded !== 0) {
                detailPipeline = detailPipeline.rotate(rotationNeeded);
            }
            const renderedDetailedImageBuffer = await detailPipeline.png().toBuffer();
            fs.unlinkSync(detailedTempPagePath);

            const crops = await cropByRectangles(outputPath, detection, pageFolder, pageNumber, logger, timer, renderedDetailedImageBuffer, config.CROP_EDGE_INSET_PX,);

            results.push({
                pageNumber,
                outputPath: outputPath,
                width: imageInfo.width!,
                height: imageInfo.height!,
                centerUnitPath: crops.centerUnitPath,
                floorPlanPath: crops.floorPlanPath,
                rectangleCount: crops.rectangleCount,
                rotationNeeded,
                excludeRectangles: crops.excludeRectangles,
            });

            logger.debug(`Page ${pageNumber} fully processed!`);
        }

        // Clean up temp directories
        try {
            fs.rmSync(detailTempDir, { recursive: true, force: true });
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch (error) {
            logger.warn(`Failed to clean up temp directories: ${error}`);
        }

        logger.finish(`Finished batch processing ${results.length} pages!`);
        return results;
    });
}
