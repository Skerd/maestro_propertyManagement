import fs from 'fs';
import path from 'path';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from './config';
import {ensureDir} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/fileUtils';
import {
    boostImageMaxInMemory,
    overlayDetectedLines,
    renderDetailPagesBatchWithGhostscript,
    renderPagesBatchWithGhostscript,
    renderPageToPng
} from './imageProcessing';
import {cropByRectangles} from './rectangleCropping';
import type {PageImageResult} from './types';

/**
 * Ghostscript raster at `-r` matches PDF points as: px ≈ pt * (resolution / 72).
 * When that matches the PNG size, GS already applied CropBox + /Rotate like a normal viewer — skip legacy flips.
 * Otherwise keep the old portrait/landscape heuristic (Y-axis quirks on some GS paths).
 */
function rotationAfterGhostscriptPng(
    pngWidth: number,
    pngHeight: number,
    displayWidthPts: number,
    displayHeightPts: number
): number {
    const resolution = Math.round(config.DEFAULT_DPI * config.DEFAULT_SCALE);
    const expectW = Math.max(1, Math.round((displayWidthPts * resolution) / 72));
    const expectH = Math.max(1, Math.round((displayHeightPts * resolution) / 72));
    const tol = Math.max(4, Math.round(resolution / 100));

    if (Math.abs(pngWidth - expectW) <= tol && Math.abs(pngHeight - expectH) <= tol) {
        return 0;
    }

    const isPortrait = pngHeight > pngWidth;
    const isLandscape = pngWidth > pngHeight;
    if (isPortrait) {
        return 270;
    }
    if (isLandscape) {
        return 180;
    }
    return 0;
}

export async function savePageImage(
    inputPath: string,
    pdfDoc: PDFDocument,
    parentLogger: serverLogger,
    pageIndex: number,
    outputRoot: string,
    timer: PerformanceTimer
): Promise<PageImageResult> {
    return await timer.timeAsync('savePageImage', async () => {
        const logger = getLogger("save_page_image", parentLogger);
        logger.start(`Processing page ${pageIndex + 1}...`);

        const pageNumber = pageIndex + 1;
        const page = pdfDoc.getPage(pageIndex);
        const rotation = page.getRotation().angle;
        const isRotated = Math.abs(rotation) % 180 !== 0;
        const rawWidth = page.getWidth();
        const rawHeight = page.getHeight();
        const displayWidth = isRotated ? rawHeight : rawWidth;
        const displayHeight = isRotated ? rawWidth : rawHeight;
        const pageWidth = Math.round(displayWidth * config.DEFAULT_SCALE);
        const pageHeight = Math.round(displayHeight * config.DEFAULT_SCALE);

        const pageFolder = path.join(outputRoot, `page-${pageNumber}`);
        ensureDir(pageFolder, logger);

        const outputPath = path.join(pageFolder, `page-${pageNumber}.png`); // Light image for cropping
        const darkImagePath = path.join(pageFolder, `page-${pageNumber}-dark.png`); // Dark image for line detection
        const boostedOutputPath = path.join(pageFolder, `page-${pageNumber}-boosted.png`);
        const overlayOutputPath = path.join(pageFolder, `page-${pageNumber}-lines.png`);

        logger.debug("Rendering light image for cropping...");
        renderPageToPng(inputPath, pageNumber, outputPath, logger, timer, false); // Light image (no dark vectors)
        logger.debug("Finished rendering light image!");

        logger.debug("Rendering dark image for line detection...");
        renderPageToPng(inputPath, pageNumber, darkImagePath, logger, timer, true); // Dark image (with dark vectors)
        logger.debug("Finished rendering dark image!");

        if (!fs.existsSync(outputPath)) {
            logger.warn(`Rendered image not found at ${outputPath}`);
        }

        // Keep rendered image buffer in memory for OCR if needed (before rotation/deletion)
        let renderedImageBuffer: Buffer | undefined;

        // Determine rotation needed by checking the light image
        // PDF pages are landscape, so ensure all images end up landscape (width > height)
        let rotationNeeded = 0;
        if (fs.existsSync(outputPath)) {
            try {
                // Read image into memory before processing (for OCR fallback)
                renderedImageBuffer = await sharp(outputPath).png().toBuffer();

                const imageInfo = await sharp(renderedImageBuffer).metadata();
                const w = imageInfo.width ?? 0;
                const h = imageInfo.height ?? 0;
                rotationNeeded = rotationAfterGhostscriptPng(w, h, displayWidth, displayHeight);
                logger.debug(
                    `Image dimensions: ${w}x${h}, displayPts=${displayWidth}x${displayHeight}, post-GS rotate=${rotationNeeded}°`
                );
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.warn(`Failed to check image orientation for page ${pageNumber}: ${errorMsg}`);
            }
        }
        
        // Apply rotation to both light and dark images
        if (rotationNeeded !== 0) {
            logger.debug(`Rotating both images for page ${pageNumber} by ${rotationNeeded}°`);
            
            // Rotate light image
            if (fs.existsSync(outputPath)) {
                try {
                    renderedImageBuffer = await sharp(outputPath).png().toBuffer();
                    renderedImageBuffer = await sharp(renderedImageBuffer)
                        .rotate(rotationNeeded)
                        .png()
                        .toBuffer();
                    fs.writeFileSync(outputPath, renderedImageBuffer);
                    const rotatedInfo = await sharp(renderedImageBuffer).metadata();
                    logger.debug(`Light image after rotation: ${rotatedInfo.width}x${rotatedInfo.height}`);
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed to rotate light image for page ${pageNumber}: ${errorMsg}`);
                }
            }
            
            // Rotate dark image
            if (fs.existsSync(darkImagePath)) {
                try {
                    const darkBuffer = await sharp(darkImagePath).png().toBuffer();
                    const rotatedDarkBuffer = await sharp(darkBuffer)
                        .rotate(rotationNeeded)
                        .png()
                        .toBuffer();
                    fs.writeFileSync(darkImagePath, rotatedDarkBuffer);
                    const rotatedInfo = await sharp(rotatedDarkBuffer).metadata();
                    logger.debug(`Dark image after rotation: ${rotatedInfo.width}x${rotatedInfo.height}`);
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed to rotate dark image for page ${pageNumber}: ${errorMsg}`);
                }
            }
        } else {
            logger.debug(`Page ${pageNumber} is already correctly oriented, no rotation needed`);
        }

        // Use dark image for line detection (better contrast for detecting lines)
        const lineDetectionImagePath = fs.existsSync(darkImagePath) ? darkImagePath : outputPath;
        
        // Boost dark image for line detection (always needed for processing)
        logger.debug("Boosting dark image to make black lines visible...");
        let boostedBuffer: Buffer = await boostImageMaxInMemory(lineDetectionImagePath, logger, timer, boostedOutputPath);
        logger.debug("Finished boosting dark image in memory (no disk I/O)!");

        // Detect lines using dark/boosted image (always needed for rectangle detection)
        logger.debug("Detecting lines from dark image...");
        const detection = await overlayDetectedLines(
            boostedBuffer,
            overlayOutputPath,
            logger,
            timer
        );
        logger.debug("Finished detecting lines!");

        // Use light image for cropping (better quality, not too dark)
        logger.debug("Saving cropping needed parts of the image (using light image)...");
        const baseRasterDpi = Math.round(config.DEFAULT_DPI * config.DEFAULT_SCALE);
        const crops = await cropByRectangles(
            outputPath,
            detection,
            pageFolder,
            pageNumber,
            logger,
            timer,
            config.CROP_EDGE_INSET_PX,
            {
                pdfPath: inputPath,
                baseRasterDpi,
                detailRasterDpi: config.CROP_DETAIL_RASTER_DPI,
                postGhostscriptRotate: rotationNeeded,
            }
        );
        logger.debug("Finished saving cropping needed parts of the image!");
        
        // Clean up dark image (only needed for line detection, not for final output)
        if (fs.existsSync(darkImagePath)) {
            fs.unlinkSync(darkImagePath);
            logger.debug(`Cleaned up dark image: ${darkImagePath}`);
        }
        
        // Delete original if not needed
        if (!config.SAVE_ORIGINAL_IMAGE && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        logger.finish("Finished converting pdf page to image!");

        return {
            pageNumber,
            outputPath: config.SAVE_ORIGINAL_IMAGE ? outputPath : '',
            width: pageWidth,
            height: pageHeight,
            centerUnitPath: crops.centerUnitPath,
            floorPlanPath: crops.floorPlanPath,
            rectangleCount: crops.rectangleCount,
            renderedImageBuffer: renderedImageBuffer // Keep in memory for OCR if needed
        };
    });
}

/**
 * Batch processes multiple PDF pages efficiently
 */
export async function batchRenderAndProcessPages(
    inputPath: string,
    pdfDoc: PDFDocument,
    parentLogger: serverLogger,
    pageIndices: number[],
    outputRoot: string,
    timer: PerformanceTimer
): Promise<PageImageResult[]> {
    return await timer.timeAsync('batchRenderAndProcessPages', async () => {
        const logger = getLogger("batch_render_and_process", parentLogger);
        logger.start(`Batch processing ${pageIndices.length} pages...`);

        if (pageIndices.length === 0) {
            return [];
        }

        const firstPage = pageIndices[0] + 1;
        const lastPage = pageIndices[pageIndices.length - 1] + 1;

        // Create temp directory for batch output
        const tempDir = path.join(outputRoot, '_temp_batch');
        ensureDir(tempDir, logger);

        // Batch render all pages at once
        // Use just the filename pattern - renderPagesBatchWithGhostscript will handle the path joining
        logger.debug(`Batch rendering pages ${firstPage}-${lastPage}...`);
        const pageToPath = renderPagesBatchWithGhostscript(inputPath, firstPage, lastPage, 'page-%d.png', tempDir, logger, timer);
        logger.debug("Finished batch rendering!");

        // Batch-render all pages at high detail DPI in one GS call (replaces N per-page GS calls)
        let detailTempDir: string | undefined;
        let detailPageToPath: Map<number, string> | undefined;
        if (config.CROP_HIGH_DETAIL_FROM_PDF) {
            detailTempDir = path.join(outputRoot, '_temp_detail_batch');
            ensureDir(detailTempDir, logger);
            logger.debug(`Batch detail rendering pages ${firstPage}-${lastPage} @ ${config.CROP_DETAIL_RASTER_DPI} DPI...`);
            try {
                detailPageToPath = renderDetailPagesBatchWithGhostscript(
                    inputPath, firstPage, lastPage, 'detail-%d.png', detailTempDir,
                    config.CROP_DETAIL_RASTER_DPI, logger, timer
                );
                logger.debug("Finished batch detail rendering!");
            } catch (err) {
                logger.warn(`Batch detail render failed, will fall back to per-page render: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        const results: PageImageResult[] = [];

        // Process each rendered page
        for (const pageIndex of pageIndices) {
            const pageNumber = pageIndex + 1;
            const tempPagePath = pageToPath.get(pageNumber);

            if (!tempPagePath || !fs.existsSync(tempPagePath)) {
                logger.warn(
                    `Batch rendered file missing for page ${pageNumber}, falling back to individual rendering`
                );
                results.push(await savePageImage(inputPath, pdfDoc, logger, pageIndex, outputRoot, timer));
                continue;
            }

            logger.debug(`Using batch rendered file for page ${pageNumber}`);

            // Move to final location and process
            const pageFolder = path.join(outputRoot, `page-${pageNumber}`);
            ensureDir(pageFolder, logger);
            const outputPath = path.join(pageFolder, `page-${pageNumber}.png`);
            
            // Get page attributes before processing
            const page = pdfDoc.getPage(pageIndex);
            const rotation = page.getRotation().angle;
            const isRotated = Math.abs(rotation) % 180 !== 0;
            const rawWidth = page.getWidth();
            const rawHeight = page.getHeight();
            const displayWidth = isRotated ? rawHeight : rawWidth;
            const displayHeight = isRotated ? rawWidth : rawHeight;
            const pageWidth = Math.round(displayWidth * config.DEFAULT_SCALE);
            const pageHeight = Math.round(displayHeight * config.DEFAULT_SCALE);

            // Keep rendered image buffer in memory for OCR if needed (before rotation/deletion)
            let renderedImageBuffer: Buffer = await sharp(tempPagePath).png().toBuffer();
            let imageInfo = await sharp(renderedImageBuffer).metadata();
            const w = imageInfo.width ?? 0;
            const h = imageInfo.height ?? 0;
            const rotationNeeded = rotationAfterGhostscriptPng(w, h, displayWidth, displayHeight);

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

            const boostedOutputPath = path.join(pageFolder, `page-${pageNumber}-boosted.png`);
            const overlayOutputPath = path.join(pageFolder, `page-${pageNumber}-lines.png`);

            // Pass the already-in-memory buffer to avoid a redundant disk read in boost
            let boostedBuffer: Buffer = await boostImageMaxInMemory(renderedImageBuffer, logger, timer, boostedOutputPath);
            // Detect lines using the boosted image
            const detection = await overlayDetectedLines(boostedBuffer, overlayOutputPath, logger, timer);

            // Read pre-rendered detail buffer for this page if batch detail render succeeded
            let preRenderedDetailBuffer: Buffer | undefined;
            if (detailPageToPath) {
                const detailFilePath = detailPageToPath.get(pageNumber);
                if (detailFilePath && fs.existsSync(detailFilePath)) {
                    try {
                        preRenderedDetailBuffer = await sharp(detailFilePath).png().toBuffer();
                        fs.unlinkSync(detailFilePath); // free disk immediately after read
                    } catch (err) {
                        logger.warn(`Failed to read detail buffer for page ${pageNumber}: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
            }

            // Use light image for cropping (better quality, not too dark)
            const baseRasterDpi = Math.round(config.DEFAULT_DPI * config.DEFAULT_SCALE);
            const crops = await cropByRectangles(
                outputPath,
                detection,
                pageFolder,
                pageNumber,
                logger,
                timer,
                config.CROP_EDGE_INSET_PX,
                {
                    pdfPath: inputPath,
                    baseRasterDpi,
                    detailRasterDpi: config.CROP_DETAIL_RASTER_DPI,
                    postGhostscriptRotate: rotationNeeded,
                    preRenderedDetailBuffer,
                }
            );

            // Delete original if not needed
            if (!config.SAVE_ORIGINAL_IMAGE && fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }

            results.push({
                pageNumber,
                outputPath: config.SAVE_ORIGINAL_IMAGE ? outputPath : '',
                width: imageInfo.width,
                height: imageInfo.height,
                centerUnitPath: crops.centerUnitPath,
                floorPlanPath: crops.floorPlanPath,
                rectangleCount: crops.rectangleCount,
                renderedImageBuffer: renderedImageBuffer // Keep in memory for OCR if needed
            });
        }

        // Clean up detail temp directory (any files not yet deleted per-page)
        if (detailTempDir) {
            try {
                fs.rmSync(detailTempDir, { recursive: true, force: true });
            } catch (error) {
                logger.warn(`Failed to clean up detail temp directory: ${error}`);
            }
        }

        // Clean up preview temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            logger.warn(`Failed to clean up temp directory: ${error}`);
        }

        logger.finish(`Finished batch processing ${results.length} pages!`);
        return results;
    });
}
