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
    batchExtractTextSpans,
    filterTextSpansOutsideRectangles,
    formatTextSpansAsPageText,
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/pdfTextBboxFilterUtils';
import {
    classifyPageType,
    extractFloorLabel,
    extractPdfTextData,
    getFloorFolderName,
    organizeImages,
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/ocrUtils';
import {overlayPolygonsOnImage} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/polygonExtraction';
import {
    alignUnitHighlight,
    beginFloorAlign,
    groupBySchematicSize,
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/orbHomographyAlign';
import type {OcrSummary, PageImageResult, TextExtractionMethod} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types';
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
    let textExtractionMethod: TextExtractionMethod = 'ghostscript';
    ensureDir(gsTempDir, logger);
    try {
        const {spans: spanMap, extractionMethod} = batchExtractTextSpans(pdfFilePath, 1, pageCount, gsTempDir, logger, timer);
        textExtractionMethod = extractionMethod;
        const resultByPage = new Map(results.map((r) => [r.pageNumber, r]));
        for (let page = 1; page <= pageCount; page++) {
            const spans = spanMap.get(page) ?? [];
            const pageResult = resultByPage.get(page);
            if (!pageResult || !pageResult.excludeRectangles?.length) {
                gsPageTextMap.set(page, formatTextSpansAsPageText(spans));
                continue;
            }
            const filterCtx = {
                imageWidth: pageResult.width,
                imageHeight: pageResult.height,
                rotationNeeded: pageResult.rotationNeeded ?? 0,
                excludeRectangles: pageResult.excludeRectangles,
            };
            const filtered = filterTextSpansOutsideRectangles(spans, filterCtx);
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
                gsPageTextMap.get(result.pageNumber) ?? '',
                result.rectangleCount,
                textExtractionMethod,
            );
            const floorLabel = extractFloorLabel(ocrData);
            const floorKey = getFloorFolderName(floorLabel);
            const pageType = ocrData.type ?? classifyPageType(ocrData, result.pageNumber, result.rectangleCount);
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

    // ORB + homography once per (floor, schematic size); fast polygon extract+composite per unit.
    logger.debug('Aligning unit floor plans via ORB homography and extracting highlight polygons...');
    for (const [floorKey, floorData] of Object.entries(ocrSummary.floors)) {
        const floorMasterPlanPath = path.join(outputRoot, 'floors', floorKey, 'floor-plan.png');
        if (!fs.existsSync(floorMasterPlanPath)) {
            logger.warn(`No floor master at ${floorMasterPlanPath}; skipping homography polygons for ${floorKey}`);
            continue;
        }

        const unitJobs: Array<{
            unitName: string;
            unitSummary: (typeof floorData.units)[string][number];
            unitSlug: string;
            floorPlanPath: string;
            outDir: string;
        }> = [];

        for (const [unitName, unitSummaries] of Object.entries(floorData.units)) {
            for (const unitSummary of unitSummaries) {
                const unitSlug = slugifyLabel(unitName);
                const unitFolder = path.join(outputRoot, 'floors', floorKey, 'units', unitSlug);
                const floorPlanPath = path.join(unitFolder, 'floor-plan.png');
                if (!fs.existsSync(floorPlanPath)) {
                    logger.warn(`Floor plan thumbnail not found at ${floorPlanPath} for unit ${unitName}`);
                    continue;
                }
                const outDir = path.join(unitFolder, 'new');
                ensureDir(outDir, logger);
                unitJobs.push({unitName, unitSummary, unitSlug, floorPlanPath, outDir});
            }
        }

        if (unitJobs.length === 0) {
            logger.warn(`No unit schematics for ${floorKey}; skipping homography`);
            continue;
        }

        // Unit pages within one floor are not guaranteed to share a paper size
        // (Dyeus_Album mixes A4 and A3), and the thumbnail scales with the page.
        // The homography bakes in its reference schematic's scale, so reusing an
        // A4-fitted matrix on an A3 thumbnail throws the polygon off the master.
        // One session per distinct thumbnail size.
        const sizeGroups = await groupBySchematicSize(unitJobs, (job) => job.floorPlanPath);
        if (sizeGroups.length > 1) {
            logger.debug(
                `${floorKey}: unit schematics span ${sizeGroups.length} sizes ` +
                `(${sizeGroups.map((g) => `${g.width}×${g.height}×${g.jobs.length}u`).join(', ')}) — ` +
                `fitting one homography per size`
            );
        }

        for (const group of sizeGroups) {
            let session: Awaited<ReturnType<typeof beginFloorAlign>> | undefined;
            try {
                session = await beginFloorAlign(floorMasterPlanPath, group.jobs[0].floorPlanPath);
                logger.debug(
                    `ORB homography ready for ${floorKey} [${group.width}×${group.height}]: inliers=${session.inliers}, ` +
                    `master ${session.width}×${session.height}, units=${group.jobs.length}`
                );

                for (const job of group.jobs) {
                    try {
                        const highlightPath = path.join(job.outDir, 'orb-homography-highlight.png');
                        const {polygons, allPolygons, allPolygonAreas} = await alignUnitHighlight(
                            session,
                            job.floorPlanPath,
                            highlightPath,
                            {polygonJsonPath: path.join(job.outDir, 'orb-homography-polygon.json')},
                        );

                        if (polygons.length > 0) {
                            job.unitSummary.polygonCoordinates = polygons;
                            logger.debug(
                                `Unit highlight OK for ${job.unitName}: ${polygons.length} pts → ${highlightPath}`
                            );

                            try {
                                await overlayPolygonsOnImage(
                                    floorMasterPlanPath,
                                    path.join(job.outDir, 'orb-homography-polygons.png'),
                                    allPolygons,
                                    allPolygonAreas,
                                    logger,
                                    timer,
                                );
                            } catch (overlayError) {
                                const overlayMessage = overlayError instanceof Error ? overlayError.message : String(overlayError);
                                logger.warn(`Failed polygon overlay for ${job.unitName}: ${overlayMessage}`);
                            }
                        } else {
                            logger.warn(`No teal highlight polygon for ${job.unitName}`);
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        logger.warn(`Failed unit highlight for ${job.unitName}: ${message}`);
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`Failed ORB homography for floor ${floorKey} [${group.width}×${group.height}]: ${message}`);
            } finally {
                session?.dispose();
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
