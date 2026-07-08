import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {getLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/config';
import {
    ensureDir,
    readPdfBytes,
    slugifyLabel
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/fileUtils';
import {
    batchRenderAndProcessPages,
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/pageProcessor';
import {batchExtractTextWithGhostscript} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/imageProcessing';
import {
    classifyPageType,
    extractFloorLabel,
    extractPdfTextData,
    getFloorFolderName,
    organizeImages,
    saveOcrDataFromBuffer
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/ocrUtils';
import {overlayPolygonsOnImage} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/polygonExtraction';
import {extractHighlightPolygonsOpencv4, type ThumbMasterRegistration} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/highlightPolygonOpencv4nodejs';
import {ProgressReporter} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/progressReporter';
import type {OcrSummary, PageImageResult} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types';
import type {serverLogger} from '@coreModule/loggers/serverLog';

export interface PdfProcessingOptions {
    /**
     * Called for each floor whose master plan was not found in the PDF.
     * Receives the floor label plus caller-provided IDs to narrow the DB query.
     * Return a local filesystem path to an existing floor plan image, or null.
     * The image will be copied to outputRoot/floors/{floorKey}/floor-plan.png.
     */
    fetchFloorImage?: (ctx: {floorLabel: string; edificeId?: string; companyId?: string}) => Promise<string | null>;
    /** Forwarded verbatim into the fetchFloorImage context. */
    edificeId?: string;
    companyId?: string;
}

const timer = new PerformanceTimer();

/**
 * Letterboxes a unit thumbnail to the same aspect ratio as the master floor plan
 * by padding with white. This aligns normalized line positions between the two
 * images, which directly improves the registration quality in polygon extraction.
 */
async function letterboxToMatchMaster(
    thumbnailPath: string,
    masterPath: string,
    logger: serverLogger
): Promise<void> {
    try {
        const [thumbMeta, masterMeta] = await Promise.all([
            sharp(thumbnailPath).metadata(),
            sharp(masterPath).metadata(),
        ]);
        const mw = masterMeta.width ?? 1;
        const mh = masterMeta.height ?? 1;
        const targetAspect = mw / mh;
        const tw = thumbMeta.width ?? 1;
        const th = thumbMeta.height ?? 1;
        const thumbAspect = tw / th;

        let newW: number, newH: number;
        if (thumbAspect > targetAspect) {
            newW = tw;
            newH = Math.round(tw / targetAspect);
        } else {
            newH = th;
            newW = Math.round(th * targetAspect);
        }

        // Already the right aspect (within 1px rounding) — nothing to do
        if (Math.abs(newW - tw) <= 1 && Math.abs(newH - th) <= 1) return;

        const padTop = Math.round((newH - th) / 2);
        const padLeft = Math.round((newW - tw) / 2);
        const tmpPath = thumbnailPath + '.letterbox.tmp.png';

        await sharp(thumbnailPath)
            .extend({
                top: padTop,
                bottom: newH - th - padTop,
                left: padLeft,
                right: newW - tw - padLeft,
                background: {r: 255, g: 255, b: 255, alpha: 1},
            })
            .png()
            .toFile(tmpPath);
        fs.renameSync(tmpPath, thumbnailPath);
        logger.debug(`Letterboxed thumbnail from ${tw}×${th} → ${newW}×${newH} (master aspect ${mw}×${mh})`);
    } catch (err) {
        logger.warn(`letterboxToMatchMaster failed for ${thumbnailPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
}

export const processPdfForFloorsAndUnits = async (
    inputPath: string,
    outputRoot: string,
    options: PdfProcessingOptions = {}
): Promise<OcrSummary> => {
    timer.startTotal();
    const pdfBytes = timer.timeSync('readPdfBytes', () => readPdfBytes(inputPath));
    const pdfDoc = await timer.timeAsync('PDFDocument.load', () => PDFDocument.load(pdfBytes));
    const pageCount = pdfDoc.getPageCount();
    const pdfFilePath = path.resolve(inputPath);

    const logger = getLogger("automatically_generate_floors_and_units");
    logger.start(`Starting to automatically generate floors and units, [${config.DEFAULT_DPI} dpi] [${config.DEFAULT_SCALE}x scale] [${pageCount} pages]`);

    ensureDir(outputRoot, logger);

    const reporter = new ProgressReporter(outputRoot, pageCount);
    const ocrSummary: OcrSummary = { floors: {} };

    logger.debug("Extracting images (batch Ghostscript)...");
    const pageIndices: number[] = Array.from({ length: pageCount }, (_, i) => i);
    const results: PageImageResult[] = await batchRenderAndProcessPages(inputPath, pdfDoc, logger, pageIndices, outputRoot, timer);

    // Batch-extract page text with a single GS process
    const gsTempDir = path.join(outputRoot, '_temp_gs_text');
    let gsPageTextMap: Map<number, string> = new Map();
    if (config.TEXT_EXTRACTION_METHOD === 'pdf') {
        ensureDir(gsTempDir, logger);
        try {
            gsPageTextMap = batchExtractTextWithGhostscript(pdfFilePath, 1, pageCount, gsTempDir, logger, timer);
        } catch (err) {
            logger.warn(`Batch GS text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            try { fs.rmSync(gsTempDir, { recursive: true, force: true }); } catch {}
        }
    }

    // Process results for text extraction summary
    for (const result of results) {
        try {
            const pageFolder = path.dirname(result.outputPath);

            let ocrData;
            if (config.TEXT_EXTRACTION_METHOD === 'pdf') {
                ocrData = await extractPdfTextData(
                    pdfBytes, result.pageNumber - 1, pageFolder, result.pageNumber, logger, timer,
                    result.renderedImageBuffer, pdfFilePath,
                    gsPageTextMap.get(result.pageNumber)
                );
            } else {
                if (result.renderedImageBuffer) {
                    ocrData = await saveOcrDataFromBuffer(result.renderedImageBuffer, pageFolder, result.pageNumber, logger, timer);
                } else {
                    logger.warn(`OCR method selected but no image available for page ${result.pageNumber}. Falling back to PDF text extraction.`);
                    ocrData = await extractPdfTextData(pdfBytes, result.pageNumber - 1, pageFolder, result.pageNumber, logger, timer);
                }
            }

            const floorLabel = extractFloorLabel(ocrData);
            const floorKey = getFloorFolderName(floorLabel);
            const pageType = classifyPageType(ocrData, result.pageNumber, result.rectangleCount);
            logger.debug(`Page ${result.pageNumber}: rectangleCount=${result.rectangleCount} → classified as '${pageType}' (floor=${floorLabel})`);

            if (!ocrSummary.floors[floorKey]) {
                ocrSummary.floors[floorKey] = {
                    floor: floorLabel,
                    units: {}
                };
            }

            if (pageType === 'unit') {
                const unitName = ocrData.name || 'Unknown Unit';
                if (!ocrSummary.floors[floorKey].units[unitName]) {
                    ocrSummary.floors[floorKey].units[unitName] = [];
                }
                ocrSummary.floors[floorKey].units[unitName].push({
                    name: unitName,
                    netArea: ocrData.netArea,
                    sharedArea: ocrData.sharedArea,
                    totalArea: ocrData.totalArea,
                    verandaArea: ocrData.verandaArea,
                    confidence: ocrData.confidence,
                    rawTextLength: ocrData.rawText.length,
                    pageNumber: result.pageNumber
                });
            }

            const unitName = ocrData.name || 'Unknown Unit';
            organizeImages(outputRoot, floorLabel, unitName, result.pageNumber, {
                centerUnitPath: result.centerUnitPath,
                floorPlanPath: result.floorPlanPath,
                rectangleCount: result.rectangleCount
            }, pageType, logger, result.outputPath);

            reporter.reportPageComplete(result.pageNumber, {
                classification: pageType,
                floorLabel,
                unitName: pageType === 'unit' ? unitName : undefined,
                rectangleCount: result.rectangleCount,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Text extraction summary skipped for page ${result.pageNumber}: ${message}`);
            reporter.reportPageComplete(result.pageNumber, {
                classification: 'floor',
                floorLabel: 'Unknown',
                rectangleCount: result.rectangleCount,
                warning: message.slice(0, 80),
            });
        }
    }

    logger.debug("Finished extracting images.");

    // For each floor missing a master plan, try the DB callback — no placeholder fallback.
    for (const [floorKey, floorData] of Object.entries(ocrSummary.floors)) {
        const floorFolder = path.join(outputRoot, 'floors', floorKey);
        const floorTarget = path.join(floorFolder, 'floor-plan.png');
        if (fs.existsSync(floorTarget)) continue;

        if (options.fetchFloorImage) {
            try {
                const fetched = await options.fetchFloorImage({
                    floorLabel: floorData.floor,
                    edificeId: options.edificeId,
                    companyId: options.companyId,
                });
                if (fetched && fs.existsSync(fetched)) {
                    ensureDir(floorFolder, logger);
                    fs.copyFileSync(fetched, floorTarget);
                    logger.debug(`Fetched floor plan from DB for ${floorKey} (${floorData.floor})`);
                    continue;
                }
            } catch (err) {
                logger.warn(`fetchFloorImage failed for ${floorData.floor}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        logger.warn(`No floor plan found for ${floorKey} (${floorData.floor}) — polygon extraction will be skipped for this floor`);
    }

    // Extract polygons from each unit's `floor-plan.png` (under units/<slug>/).
    logger.debug("Extracting polygon coordinates from unit floor plans...");
    const floorRegCache = new Map<string, ThumbMasterRegistration>();
    for (const [floorKey, floorData] of Object.entries(ocrSummary.floors)) {
        const floorMasterPlanPath = path.join(outputRoot, 'floors', floorKey, 'floor-plan.png');
        const masterExists = fs.existsSync(floorMasterPlanPath);

        for (const [unitName, unitSummaries] of Object.entries(floorData.units)) {
            for (const unitSummary of unitSummaries) {
                try {
                    const unitSlug = slugifyLabel(unitName);
                    const unitFolder = path.join(outputRoot, 'floors', floorKey, 'units', unitSlug);
                    const floorPlanPath = path.join(unitFolder, 'floor-plan.png');

                    if (!fs.existsSync(floorPlanPath)) {
                        logger.warn(`Floor plan thumbnail not found at ${floorPlanPath} for unit ${unitName}`);
                        reporter.reportPolygonResult(unitName, floorKey, false);
                        continue;
                    }

                    // Letterbox the unit thumbnail to the master's aspect ratio before registration.
                    // This makes structural lines appear at proportionally similar positions in
                    // both images, improving the angle+position segment matching.
                    if (config.UNIT_FLOOR_PLAN_MATCH_MASTER_ASPECT && masterExists) {
                        await letterboxToMatchMaster(floorPlanPath, floorMasterPlanPath, logger);
                    }

                    if (!masterExists) {
                        logger.debug(`No floor master at ${floorMasterPlanPath}; polygon uses unit floor-plan only for ${unitName}`);
                    }

                    logger.debug(`Extracting polygon from ${floorPlanPath} for unit ${unitName}...`);
                    const {unitPolygon, allPolygons, allPolygonAreas, registeredToMaster, computedRegistration} = await extractHighlightPolygonsOpencv4(
                        floorPlanPath,
                        masterExists ? floorMasterPlanPath : undefined,
                        path.join(unitFolder, 'highlight-debug'),
                        logger,
                        timer,
                        floorRegCache.get(floorKey),
                    );

                    if (computedRegistration) {
                        floorRegCache.set(floorKey, computedRegistration);
                    }

                    if (unitPolygon && unitPolygon.length > 0) {
                        unitSummary.polygonCoordinates = unitPolygon;
                        logger.debug(`Successfully extracted polygon with ${unitPolygon.length} points for unit ${unitName} (registeredToMaster=${registeredToMaster})`);
                        reporter.reportPolygonResult(unitName, floorKey, true, unitPolygon.length, registeredToMaster);

                        if (config.SAVE_POLYGON_OVERLAY) {
                            const pageNumber = unitSummary.pageNumber;
                            const pageFolder = path.join(outputRoot, `page-${pageNumber}`);
                            const overlayPath = path.join(pageFolder, `page-${pageNumber}-polygon-overlay.png`);
                            if (!fs.existsSync(pageFolder)) {
                                ensureDir(pageFolder, logger);
                            }
                            try {
                                await overlayPolygonsOnImage(floorPlanPath, overlayPath, allPolygons, allPolygonAreas, logger, timer);
                                logger.debug(`Saved polygon overlay (${allPolygons.length} region(s)) to ${overlayPath} for unit ${unitName} (page ${pageNumber})`);
                            } catch (overlayError) {
                                const overlayMessage = overlayError instanceof Error ? overlayError.message : String(overlayError);
                                logger.warn(`Failed to create polygon overlay for unit ${unitName}: ${overlayMessage}`);
                            }
                        }
                    } else if (allPolygons.length > 0) {
                        logger.debug(`No unit polygon after filters for ${unitName}; saving ${allPolygons.length} overlay region(s) for QA`);
                        reporter.reportPolygonResult(unitName, floorKey, false);
                    } else {
                        logger.warn(`No highlight regions in ${floorPlanPath} for unit ${unitName}`);
                        reporter.reportPolygonResult(unitName, floorKey, false);
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed to extract polygon for unit ${unitName}: ${message}`);
                    reporter.reportPolygonResult(unitName, floorKey, false);
                }
            }
        }
    }
    logger.debug("Finished extracting polygon coordinates.");

    const summaryPath = path.join(outputRoot, 'ocr-summary.json');
    timer.timeSync('writeOcrSummary', () => {
        fs.writeFileSync(summaryPath, JSON.stringify(ocrSummary, null, 2), 'utf-8');
    });

    reporter.finish(ocrSummary);
    console.log(timer.getSummary());
    logger.finish("Finished automatically generate floors and units!");
    return ocrSummary;
};
