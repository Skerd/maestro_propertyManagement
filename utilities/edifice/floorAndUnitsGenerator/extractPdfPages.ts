import fs from 'fs';
import path from 'path';
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
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/pageProcessorUtils';
import {
    batchExtractTextSpansWithGhostscript,
    filterTextSpansOutsideRectangles,
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/pdfTextBboxFilterUtils';
import {
    classifyPageType,
    extractFloorLabel,
    extractPdfTextData,
    getFloorFolderName,
    organizeImages,
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/ocrUtils';
import {overlayPolygonsOnImage} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/polygonExtraction';
import {alignAndHighlight} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/orbHomographyAlign';
import type {OcrSummary, PageImageResult} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types';
import {
    batchExtractTextWithGhostscript
} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/imageUtils";

global.ServerName = "FloorAndUnitsGenerator";

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


export const processPdfForFloorsAndUnits = async (inputPath: string, outputRoot: string, options: PdfProcessingOptions = {}): Promise<OcrSummary> => {

    timer.startTotal();
    const pdfBytes = timer.timeSync('readPdfBytes', () => readPdfBytes(inputPath));
    const pdfDoc = await timer.timeAsync('PDFDocument.load', () => PDFDocument.load(pdfBytes));
    const pageCount = pdfDoc.getPageCount();
    const pdfFilePath = path.resolve(inputPath);

    const logger = getLogger("automatically_generate_floors_and_units");
    logger.start(`Starting to automatically generate floors and units, [${pageCount} pages]`);

    ensureDir(outputRoot, logger);

    const ocrSummary: OcrSummary = { floors: {} };

    logger.debug("Extracting images (batch Ghostscript)...");
    const results: PageImageResult[] = [];
    for (let i = 0; i < pageCount; i += config.BATCH_PDF_PAGES_TO_IMAGES) {
        const indexes = [];
        for (let j = i; j < Math.min(i + config.BATCH_PDF_PAGES_TO_IMAGES, pageCount); j++) {
            indexes.push(j);
        }
        results.push(...await batchRenderAndProcessPages(inputPath, pdfDoc, logger, indexes, outputRoot, timer, pageCount))
    }
    logger.debug("Finished extracting and processing images!");

    // Extract positioned text from the original PDF, then drop spans that fall inside
    // detected plan rectangles.
    const gsTempDir = path.join(outputRoot, '_temp_gs_text');
    let gsPageTextMap: Map<number, string> = new Map();
    ensureDir(gsTempDir, logger);
    try {
        const spanMap = batchExtractTextSpansWithGhostscript(pdfFilePath, 1, pageCount, gsTempDir, logger, timer);
        const resultByPage = new Map(results.map((r) => [r.pageNumber, r]));
        for (let page = 1; page <= pageCount; page++) {
            const spans = spanMap.get(page) ?? [];
            const pageResult = resultByPage.get(page);
            if (!pageResult || !pageResult.excludeRectangles?.length) {
                gsPageTextMap.set(page, spans.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim());
                continue;
            }
            const filtered = filterTextSpansOutsideRectangles(spans, {
                imageWidth: pageResult.width,
                imageHeight: pageResult.height,
                rotationNeeded: pageResult.rotationNeeded ?? 0,
                excludeRectangles: pageResult.excludeRectangles,
            });
            gsPageTextMap.set(page, filtered);
            logger.debug(
                `Page ${page}: bbox text ${spans.length} spans → ${filtered.length} chars after rectangle filter`
            );
        }
    }
    catch (err) {
        logger.warn(`Batch GS bbox text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
        try {
            gsPageTextMap = batchExtractTextWithGhostscript(pdfFilePath, 1, pageCount, gsTempDir, logger, timer);
        } catch (fallbackErr) {
            logger.warn(`Fallback GS text extraction failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
        }
    }
    finally {
        try { fs.rmSync(gsTempDir, { recursive: true, force: true }); } catch {}
    }


    // Process results for text extraction summary
    for (const result of results) {
        try {
            const pageFolder = path.dirname(result.outputPath);

            let ocrData  = await extractPdfTextData(
                pageFolder,
                result.pageNumber,
                logger,
                timer,
                gsPageTextMap.get(result.pageNumber) ?? ''
            );
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

            if (pageType === 'floor') {
                // Keep the latest floor master page when multiple floor pages share a label.
                ocrSummary.floors[floorKey].pageNumber = result.pageNumber;
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Text extraction summary skipped for page ${result.pageNumber}: ${message}`);
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

    // ORB + homography: warp unit teal highlight onto floor master, extract polygons (master fractional coords).
    logger.debug('Aligning unit floor plans via ORB homography and extracting highlight polygons...');
    for (const [floorKey, floorData] of Object.entries(ocrSummary.floors)) {
        const floorMasterPlanPath = path.join(outputRoot, 'floors', floorKey, 'floor-plan.png');
        if (!fs.existsSync(floorMasterPlanPath)) {
            logger.warn(`No floor master at ${floorMasterPlanPath}; skipping homography polygons for ${floorKey}`);
            continue;
        }

        for (const [unitName, unitSummaries] of Object.entries(floorData.units)) {
            for (const unitSummary of unitSummaries) {
                try {
                    const unitSlug = slugifyLabel(unitName);
                    const unitFolder = path.join(outputRoot, 'floors', floorKey, 'units', unitSlug);
                    const floorPlanPath = path.join(unitFolder, 'floor-plan.png');

                    if (!fs.existsSync(floorPlanPath)) {
                        logger.warn(`Floor plan thumbnail not found at ${floorPlanPath} for unit ${unitName}`);
                        continue;
                    }

                    const outDir = path.join(unitFolder, 'new');
                    ensureDir(outDir, logger);
                    const highlightPath = path.join(outDir, 'orb-homography-highlight.png');

                    const {inliers, polygons, allPolygons, allPolygonAreas} = await alignAndHighlight(
                        floorMasterPlanPath,
                        floorPlanPath,
                        highlightPath,
                    );

                    if (polygons.length > 0) {
                        unitSummary.polygonCoordinates = polygons;
                        logger.debug(
                            `ORB homography OK for ${unitName}: inliers=${inliers}, ` +
                            `unit polygon ${polygons.length} pts, ${allPolygons.length} region(s) → ${highlightPath}`
                        );

                        try {
                            await overlayPolygonsOnImage(
                                floorMasterPlanPath,
                                path.join(outDir, 'orb-homography-polygons.png'),
                                allPolygons,
                                allPolygonAreas,
                                logger,
                                timer,
                            );
                        } catch (overlayError) {
                            const overlayMessage = overlayError instanceof Error ? overlayError.message : String(overlayError);
                            logger.warn(`Failed polygon overlay for ${unitName}: ${overlayMessage}`);
                        }
                    } else {
                        logger.warn(
                            `ORB homography aligned (${inliers} inliers) but no teal highlight polygon for ${unitName}`
                        );
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed ORB homography / polygon extract for unit ${unitName}: ${message}`);
                }
            }
        }
    }
    logger.debug('Finished ORB homography highlight polygon extraction.');

    const summaryPath = path.join(outputRoot, 'ocr-summary.json');
    timer.timeSync('writeOcrSummary', () => {
        fs.writeFileSync(summaryPath, JSON.stringify(ocrSummary, null, 2), 'utf-8');
    });

    console.log(timer.getSummary());
    logger.finish("Finished automatically generate floors and units!");
    return ocrSummary;
};
