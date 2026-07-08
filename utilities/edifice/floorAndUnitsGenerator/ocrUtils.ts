import fs from 'fs';
import path from 'path';
import {createWorker, Worker} from 'tesseract.js';
import sharp from 'sharp';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {ensureDir, slugifyLabel} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/fileUtils';
import {extractTextWithGhostscript} from './imageProcessing';
import {extractTextFromPdf} from './pdfTextExtractor';
import type {CropResult, ExtractedImageOcrData} from './types';

/**
 * Classifies page type as 'floor' or 'unit'.
 *
 * Two complementary signals are used (in this order):
 *   PRIORITY 0 — Visual layout (most reliable when line detection succeeds):
 *     • exactly 1 big rectangle  → 'floor'  (master plan covers the whole page)
 *     • 2+ big rectangles        → 'unit'   (top-right floor thumbnail + center unit detail)
 *     • 0 / undefined            → fall through to text heuristics
 *   PRIORITIES 1+ — OCR text heuristics (legacy fallback):
 *     building name, floor markers, area data, page-number bias, etc.
 *
 * The rectangle-count signal overrides text-based reasoning because text on a
 * unit page typically also mentions the floor (e.g. "A-13 Floor 2"), which
 * historically caused unit pages to be misclassified as floor plans.
 *
 * @param data            OCR / text extraction result for the page
 * @param pageNumber      1-based page number (used only by the text heuristics)
 * @param rectangleCount  Number of "big" rectangles detected by rectangleDetection
 *                        (already filtered by RECT_MIN_*_RATIO + dedup). Pass 0
 *                        when line detection failed to yield any usable rectangle.
 */
export function classifyPageType(
    data: ExtractedImageOcrData,
    pageNumber?: number,
    rectangleCount?: number
): 'floor' | 'unit' {
    // PRIORITY 0 — Visual layout signal (authoritative when available).
    // A single big rectangle is the unambiguous fingerprint of a floor plan
    // page; two or more big rectangles is the unambiguous fingerprint of a
    // unit page (thumbnail + detail).
    if (typeof rectangleCount === 'number' && rectangleCount > 0) {
        return rectangleCount >= 2 ? 'unit' : 'floor';
    }

    const text = data.rawText || '';
    const name = data.name || '';
    const combinedText = `${name} ${text}`.toLowerCase();

    // Unit indicators - if any of these are present, it's likely a unit
    const unitIndicators = [
        /apartamenti/i,
        /nj[ëe]si\s+banimi/i,
        /unit\s+plan/i,
        /net\s+area/i,
        /siperfaqe\s+neto/i,
        /shared\s+area/i,
        /siperfaqe\s+e\s+perbashket/i,
        /total\s+area/i,
        /siperfaqe\s+totale/i,
        /a-\d+/i,
        /apartment/i
    ];

    // Floor plan indicators - if these are present without unit indicators, it's a floor plan
    // Supports both positive and negative floor numbers (e.g., "Floor -1", "K-2", "kati -1")
    const floorIndicators = [
        /floor\s+plan/i,
        /kati\s+-?\d+/i,
        /floor\s+-?\d+/i,
        /\bk-?\d+\b/i,
        /plani\s+i\s+katit/i,
        /plan\s+of\s+floor/i,
        /album/i,  // Album often indicates floor plan overview
        /residence/i,  // Residence can indicate building/floor overview
        /suites/i  // Suites can indicate floor plan
    ];

    // Building/project name indicators - these strongly suggest floor plans
    const buildingNameIndicators = [
        /album/i,
        /residence/i,
        /suites/i,
        /building/i,
        /project/i,
        /development/i,
        /complex/i
    ];
    
    // Check building indicators in both name and text (building names often appear in text, not just name field)
    const hasBuildingName = buildingNameIndicators.some(pattern => pattern.test(name)) || 
                           buildingNameIndicators.some(pattern => pattern.test(text));
    const hasFloorIndicators = floorIndicators.some(pattern => pattern.test(combinedText));
    const hasUnitIndicators = unitIndicators.some(pattern => pattern.test(combinedText));
    
    // Check for strong floor indicators in text (like "KATI 2", "KATI -1") - these are very reliable
    const hasStrongFloorIndicator = /kati\s+-?\d+/i.test(text) || /floor\s+-?\d+/i.test(text);
    
    // PRIORITY 1: Check for building name in NAME field or TEXT (highest priority for floor plans)
    // If name or text contains building indicators (like "ALBUM SHITJESH DYEUS RESIDENCE SUITES"),
    // it's almost certainly a floor plan, even if area data exists (might be incorrectly extracted dimensions)
    if (hasBuildingName) {
        // Check if the name itself contains a unit number (like "A-13 Floor 2") - if so, it's a unit
        const nameHasUnitNumber = /a-\d+|apartamenti\s+\w*\d+|unit\s+\d+/i.test(name);
        if (!nameHasUnitNumber) {
            // Building name without unit number = floor plan
            return 'floor';
        }
    }
    
    // PRIORITY 2: Strong floor indicators in text (like "KATI 2") take precedence, especially on early pages
    // BUT: Don't override if we have clear unit indicators (units can also mention floor numbers)
    if (hasStrongFloorIndicator && !hasUnitIndicators) {
        // On early pages (first 9), strongly favor floor plan if we see floor indicators and no unit indicators
        if (pageNumber !== undefined && pageNumber <= 9) {
            return 'floor';
        }
        // Even on later pages, if we have strong floor indicators and no reasonable area data, it's likely a floor plan
        const hasReasonableArea = (data.netArea > 0 && data.netArea < 500) || 
                                  (data.sharedArea > 0 && data.sharedArea < 500) ||
                                  (data.totalArea > 0 && data.totalArea < 500);
        if (!hasReasonableArea) {
            return 'floor';
        }
    }
    
    // PRIORITY 3: Check for floor indicators (strong signal for floor plans)
    // If it has floor indicators and no unit indicators, it's a floor plan
    if (hasFloorIndicators && !hasUnitIndicators) {
        return 'floor';
    }
    
    // PRIORITY 4: Check page number (first 9 pages are often floor plans)
    if (pageNumber !== undefined && pageNumber <= 9) {
        // If it's an early page with no unit indicators, likely a floor plan
        if (!hasUnitIndicators) {
            return 'floor';
        }
    }
    
    // PRIORITY 5: Check for area data (but be more strict - dimension numbers might be extracted)
    // Only classify as unit if area data exists AND it's a reasonable value (not a dimension like 2250)
    // Typical unit areas are between 20-200 m², dimension numbers are often 1000+
    const hasAreaData = data.netArea > 0 || data.sharedArea > 0 || data.totalArea > 0;
    const hasReasonableArea = (data.netArea > 0 && data.netArea < 500) || 
                              (data.sharedArea > 0 && data.sharedArea < 500) ||
                              (data.totalArea > 0 && data.totalArea < 500);
    
    // If area data exists and is reasonable (not a dimension number), and has unit indicators, it's a unit
    // This takes precedence over floor indicators because units have measurable areas
    if (hasReasonableArea && hasUnitIndicators) {
        return 'unit';
    }
    
    // PRIORITY 6: Check for explicit unit indicators in text (like "A-210", "APARTAMENTI")
    // Unit indicators are strong signals - prioritize them unless we have very strong floor indicators
    if (hasUnitIndicators) {
        // If we have unit indicators but also strong floor indicators, check if name contains unit number
        // Unit pages often have names like "A-210 Floor 2" which contains both
        const nameHasUnitNumber = /a-\d+|apartamenti\s+\w*\d+|unit\s+\d+/i.test(name);
        if (nameHasUnitNumber) {
            // Name contains unit number = it's a unit page
            return 'unit';
        }
        // If no strong floor indicators or building name, it's likely a unit
        if (!hasStrongFloorIndicator && !hasBuildingName) {
            return 'unit';
        }
    }
    
    // PRIORITY 7: Additional heuristics for floor plans
    // If name is very long (building/project name) and has no reasonable area data, likely floor plan
    // Unit names are typically shorter (like "A-13 Floor 2"), building names are longer
    if (name.length > 20 && !hasReasonableArea && !hasUnitIndicators) {
        return 'floor';
    }

    // Default to unit if uncertain (conservative approach)
    return 'unit';
}

/**
 * Extracts floor label from OCR data
 * Supports both positive and negative floor numbers, and ranges (e.g., "Floor -1", "K-2", "kati -1", "Floor 0-1", "Floor 1-3")
 */
export function extractFloorLabel(data: ExtractedImageOcrData): string {
    const text = data.rawText || '';
    const name = data.name || '';

    // Match "Floor X-Y" or "Floor -X-Y" ranges in name field (check ranges first)
    const floorRangeFromName = name.match(/floor\s+(-?\d+)\s*-\s*(-?\d+)/i);
    if (floorRangeFromName?.[1] && floorRangeFromName?.[2]) {
        return `Floor ${floorRangeFromName[1]}-${floorRangeFromName[2]}`;
    }

    // Match "Floor X" or "Floor -X" in name field
    const floorFromName = name.match(/floor\s+(-?\d+)/i);
    if (floorFromName?.[1]) {
        return `Floor ${floorFromName[1]}`;
    }

    // Match "kati X-Y" or "kati -X-Y" ranges in text (Albanian)
    const floorRangeFromText = text.match(/kati\s+(-?\d+)\s*-\s*(-?\d+)/i);
    if (floorRangeFromText?.[1] && floorRangeFromText?.[2]) {
        return `Floor ${floorRangeFromText[1]}-${floorRangeFromText[2]}`;
    }

    // Match "kati X" or "kati -X" in text (Albanian)
    const floorFromText = text.match(/kati\s+(-?\d+)/i);
    if (floorFromText?.[1]) {
        return `Floor ${floorFromText[1]}`;
    }

    // Match "Floor X-Y" or "Floor -X-Y" ranges in text (English)
    const floorRangeEnglish = text.match(/floor\s+(-?\d+)\s*-\s*(-?\d+)/i);
    if (floorRangeEnglish?.[1] && floorRangeEnglish?.[2]) {
        return `Floor ${floorRangeEnglish[1]}-${floorRangeEnglish[2]}`;
    }

    // Match "Floor X" or "Floor -X" in text (English)
    const floorEnglish = text.match(/floor\s+(-?\d+)/i);
    if (floorEnglish?.[1]) {
        return `Floor ${floorEnglish[1]}`;
    }

    // Match "KX-Y" or "K-X-Y" range format (e.g., "K0-1", "K1-3")
    const floorKRange = text.match(/\bK(-?\d+)\s*-\s*(-?\d+)\b/i);
    if (floorKRange?.[1] && floorKRange?.[2]) {
        return `K${floorKRange[1]}-${floorKRange[2]}`;
    }

    // Match "KX" or "K-X" format (e.g., "K1", "K-1")
    const floorK = text.match(/\bK(-?\d+)\b/i);
    if (floorK?.[1]) {
        return `K${floorK[1]}`;
    }

    return 'Unknown Floor';
}

/**
 * Extracts floor number from floor label and formats it as floor-[{floor_number}]
 * Supports single numbers, negative numbers, and ranges
 * Examples:
 *   "Floor 1" → "floor-[1]"
 *   "Floor -1" → "floor-[-1]"
 *   "Floor 0-1" → "floor-[0-1]"
 *   "Floor 1-3" → "floor-[1-3]"
 *   "K1" → "floor-[1]"
 *   "K-1" → "floor-[-1]"
 *   "K0-1" → "floor-[0-1]"
 *   "Unknown Floor" → "floor-[unknown]"
 */
export function getFloorFolderName(floorLabel: string): string {
    // First try to match ranges (e.g., "0-1", "1-3", "-1-0")
    // Pattern: optional minus, digits, optional whitespace, dash, optional whitespace, optional minus, digits
    const rangeMatch = floorLabel.match(/(-?\d+)\s*-\s*(-?\d+)/);
    if (rangeMatch) {
        const floorRange = `${rangeMatch[1]}-${rangeMatch[2]}`;
        return `floor-[${floorRange}]`;
    }
    
    // Then try to match single numbers (including negative)
    const floorNumberMatch = floorLabel.match(/(-?\d+)/);
    if (floorNumberMatch) {
        const floorNumber = floorNumberMatch[1];
        return `floor-[${floorNumber}]`;
    }
    
    // If no number found, use slugified version with "floor-" prefix and brackets
    const slug = floorLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
    return `floor-[${slug || 'unknown'}]`;
}

/**
 * Organizes images into floor/unit folder structure
 * Floor plans go directly under floor folder, unit plans go under units subfolder
 */
export function organizeImages(
    outputRoot: string,
    floorLabel: string,
    unitName: string,
    pageNumber: number,
    crops: CropResult,
    pageType: 'floor' | 'unit',
    parentLogger: serverLogger,
    fullPagePath?: string  // Optional: full page image path for floor plans
): void {
    const floorSlug = getFloorFolderName(floorLabel || 'Unknown Floor');
    const unitSlug = slugifyLabel(unitName || 'unknown-unit');
    const floorFolder = path.join(outputRoot, 'floors', floorSlug);
    const unitFolder = path.join(floorFolder, 'units', unitSlug);

    ensureDir(floorFolder, parentLogger);

    if (pageType === 'floor') {
        // Floor plans: organize directly under floor folder
        // Prefer centerUnitPath (cropped center rectangle), then full page image, then floorPlanPath
        let copied = false;
        
        if (crops.centerUnitPath && fs.existsSync(crops.centerUnitPath)) {
            const floorTarget = path.join(
                floorFolder,
                `floor-plan.png`
            );
            fs.copyFileSync(crops.centerUnitPath, floorTarget);
            // parentLogger.debug(`Copied center cropped image to ${floorTarget}`);
            copied = true;
        } else if (fullPagePath && fs.existsSync(fullPagePath)) {
            const floorTarget = path.join(
                floorFolder,
                `floor-plan.png`
            );
            fs.copyFileSync(fullPagePath, floorTarget);
            parentLogger.debug(`Copied full page image to ${floorTarget}`);
            copied = true;
        } else if (crops.floorPlanPath && fs.existsSync(crops.floorPlanPath)) {
            // Fallback to floorPlanPath if centerUnitPath doesn't exist
            const floorTarget = path.join(
                floorFolder,
                `floor-plan.png`
            );
            fs.copyFileSync(crops.floorPlanPath, floorTarget);
            parentLogger.debug(`Copied floor plan detail to ${floorTarget}`);
            copied = true;
        }
        
        if (!copied) {
            parentLogger.warn(`No image found to copy for floor plan page ${pageNumber}. Checked: centerUnitPath=${crops.centerUnitPath}, fullPagePath=${fullPagePath}, floorPlanPath=${crops.floorPlanPath}`);
        }
    } else {
        // Unit plans: organize under units subfolder (existing behavior)
        ensureDir(unitFolder, parentLogger);

        if (crops.centerUnitPath && fs.existsSync(crops.centerUnitPath)) {
            const unitTarget = path.join(
                unitFolder,
                `unit-plan.png`
            );
            fs.copyFileSync(crops.centerUnitPath, unitTarget);
            // parentLogger.debug(`Copied unit plan to ${unitTarget}`);
        } else if (crops.centerUnitPath) {
            parentLogger.warn(`Unit plan image not found at ${crops.centerUnitPath}`);
        }

        if (crops.floorPlanPath && fs.existsSync(crops.floorPlanPath)) {
            const floorTarget = path.join(
                unitFolder,
                `floor-plan.png`
            );
            fs.copyFileSync(crops.floorPlanPath, floorTarget);
            parentLogger.debug(`Copied floor plan detail to ${floorTarget}`);
        } else if (crops.floorPlanPath) {
            parentLogger.warn(`Floor plan detail image not found at ${crops.floorPlanPath}`);
        }
    }
    
    parentLogger.debug(`Organized images for page ${pageNumber} (type: ${pageType}) into ${pageType === 'floor' ? floorFolder : unitFolder}`);
}

/**
 * Absolute path to the bundled floor-plan placeholder image. Anchored on
 * __dirname so it works under both ts-node and compiled output without
 * requiring a build-time copy step.
 */
export const FLOOR_PLACEHOLDER_PATH = path.resolve(__dirname, 'placeholders', 'floor_placeholder.png');

/**
 * Ensures that every floor key has a `floor-plan.png` on disk. If the floor
 * folder is missing a master plan (no page in the PDF was classified as the
 * floor master, or organizeImages couldn't find a source image), the bundled
 * `floor_placeholder.png` is copied in. This keeps downstream consumers
 * (UI rendering, polygon extraction, exports) working uniformly regardless
 * of whether the source PDF actually contained per-floor master plans.
 *
 * @returns the list of floor keys for which a placeholder was inserted
 */
export function ensureFloorPlanPlaceholders(
    outputRoot: string,
    floorKeys: Iterable<string>,
    parentLogger: serverLogger
): string[] {
    const inserted: string[] = [];
    const placeholderExists = fs.existsSync(FLOOR_PLACEHOLDER_PATH);
    if (!placeholderExists) {
        parentLogger.warn(`Floor placeholder not found at ${FLOOR_PLACEHOLDER_PATH}; cannot fill missing floor plans.`);
        return inserted;
    }

    for (const floorKey of floorKeys) {
        const floorFolder = path.join(outputRoot, 'floors', floorKey);
        const floorTarget = path.join(floorFolder, 'floor-plan.png');
        if (fs.existsSync(floorTarget)) continue;

        ensureDir(floorFolder, parentLogger);
        try {
            fs.copyFileSync(FLOOR_PLACEHOLDER_PATH, floorTarget);
            inserted.push(floorKey);
            parentLogger.warn(`No floor plan available for ${floorKey}; inserted placeholder at ${floorTarget}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            parentLogger.warn(`Failed to copy floor placeholder for ${floorKey}: ${message}`);
        }
    }
    return inserted;
}

/**
 * Extracts text data directly from PDF page (much faster than OCR)
 * Falls back to OCR using already-rendered image buffer if PDF text extraction yields insufficient data
 */
export async function extractPdfTextData(
    pdfBuffer: Buffer,
    pageIndex: number, // 0-indexed page index
    outputFolder: string,
    pageNumber: number, // 1-indexed page number for file naming
    parentLogger: serverLogger,
    timer: PerformanceTimer,
    renderedImageBuffer?: Buffer, // Optional: already-rendered image for OCR fallback
    pdfFilePath?: string, // Optional: path to PDF file (for Ghostscript txtwrite)
    preExtractedGsText?: string // Optional: GS text already extracted by a batch call
): Promise<ExtractedImageOcrData> {
    return await timer.timeAsync('extractPdfTextData', async () => {
        const logger = getLogger("extract_pdf_text", parentLogger);
        logger.start(`Extracting text data from PDF page ${pageNumber}...`);

        // Step 1: Try multiple text extraction methods
        let extractedText = '';
        let extractionMethod: 'text' | 'ocr' | 'mixed' | 'ghostscript' = 'text';

        // Use pre-extracted GS text when available (avoids spawning a per-page GS process)
        if (preExtractedGsText && preExtractedGsText.trim().length >= 50) {
            extractedText = preExtractedGsText;
            extractionMethod = 'ghostscript';
            logger.debug(`Using pre-extracted GS text (${extractedText.length} chars) for page ${pageNumber}`);
        }

        // Ghostscript txtwrite fallback (only when pre-extracted text wasn't sufficient)
        if (!extractedText && pdfFilePath && fs.existsSync(pdfFilePath)) {
            try {
                const gsText = extractTextWithGhostscript(pdfFilePath, pageNumber, logger, timer);
                if (gsText && gsText.trim().length >= 50) {
                    extractedText = gsText;
                    extractionMethod = 'ghostscript';
                    logger.debug(`Extracted ${extractedText.length} characters using Ghostscript txtwrite`);
                }
            } catch (error) {
                logger.debug('Ghostscript text extraction failed or insufficient, trying other methods', error);
            }
        }
        
        // If Ghostscript didn't work, try pdf-parse (works on PDFs with embedded text objects)
        if (!extractedText || extractedText.trim().length < 50) {
            try {
                const textResult = await extractTextFromPdf(pdfBuffer, pageIndex, logger);
                if (textResult.text && textResult.text.trim().length >= 50) {
                    extractedText = textResult.text;
                    extractionMethod = 'text';
                    logger.debug(`Extracted ${extractedText.length} characters using pdf-parse`);
                }
            } catch (error) {
                logger.debug('PDF text extraction failed, will try OCR', error);
            }
        }
        
        // Step 2: If text extraction yielded insufficient data, try OCR on already-rendered image
        if (!extractedText || extractedText.trim().length < 50) {
            if (renderedImageBuffer) {
                logger.debug('Text extraction yielded insufficient data, using already-rendered image for OCR...');
                try {
                    const ocrResult = await extractFloorPlanDataFromImage(renderedImageBuffer, logger);
                    extractedText = ocrResult.rawText;
                    extractionMethod = extractedText ? 'ocr' : 'text';
                    
                    // Use OCR parsed data
                    const jsonPath = path.join(outputFolder, `page-${pageNumber}-ocr.json`);
                    const textPath = path.join(outputFolder, `page-${pageNumber}-ocr.txt`);
                    
                    fs.writeFileSync(
                        jsonPath,
                        JSON.stringify(
                            {
                                name: ocrResult.name,
                                netArea: ocrResult.netArea,
                                sharedArea: ocrResult.sharedArea,
                                totalArea: ocrResult.totalArea,
                                verandaArea: ocrResult.verandaArea,
                                confidence: ocrResult.confidence,
                                rawTextLength: ocrResult.rawText.length,
                                metadata: { extractionMethod }
                            },
                            null,
                            2
                        ),
                        'utf-8'
                    );
                    fs.writeFileSync(textPath, ocrResult.rawText, 'utf-8');
                    
                    logger.finish(`Finished extracting text data from PDF page ${pageNumber} (method: ${extractionMethod})!`);
                    return ocrResult;
                } catch (ocrError) {
                    logger.warn('OCR extraction failed', ocrError);
                }
            } else {
                logger.warn('Text extraction yielded insufficient data but no rendered image buffer available');
            }
        }
        
        // Step 3: Parse structured data from extracted text (simple parsing, no image extraction)
        const parsedData = parseFloorPlanDataSimple(extractedText, logger);
        
        // Step 4: Calculate confidence (simple: based on text length and extracted data)
        const confidence = calculateConfidenceSimple(parsedData, extractedText.length);
        
        const ocrData: ExtractedImageOcrData = {
            name: parsedData.name,
            netArea: parsedData.netArea,
            sharedArea: parsedData.sharedArea,
            totalArea: parsedData.totalArea,
            verandaArea: parsedData.verandaArea,
            rawText: extractedText,
            confidence,
            metadata: { extractionMethod }
        };

        const jsonPath = path.join(outputFolder, `page-${pageNumber}-ocr.json`);
        const textPath = path.join(outputFolder, `page-${pageNumber}-ocr.txt`);

        fs.writeFileSync(
            jsonPath,
            JSON.stringify(
                {
                    name: ocrData.name,
                    netArea: ocrData.netArea,
                    sharedArea: ocrData.sharedArea,
                    totalArea: ocrData.totalArea,
                    verandaArea: ocrData.verandaArea,
                    confidence: ocrData.confidence,
                    rawTextLength: ocrData.rawText.length,
                    metadata: ocrData.metadata
                },
                null,
                2
            ),
            'utf-8'
        );
        fs.writeFileSync(textPath, ocrData.rawText, 'utf-8');

        logger.finish(`Finished extracting text data from PDF page ${pageNumber} (method: ${extractionMethod})!`);

        return ocrData;
    });
}

/**
 * After "APARTAMENTI &lt;id&gt;", vector PDFs (txtwrite) may inject huge spans before "KATI &lt;floor&gt;".
 */
const APARTAMENTI_KATI_SEARCH_WINDOW = 250_000;

/**
 * Formats Albanian-style unit token + floor (e.g. A02 + 4 → "A-02 Floor 4").
 */
function formatAlbanianUnitDisplayName(unitToken: string, floorDigits: string): string {
    const u = unitToken.replace(/[,;.:]+$/g, '').trim();
    if (/^A\d+$/i.test(u)) {
        return `A-${u.slice(1)} Floor ${floorDigits}`;
    }
    if (/^A-\d+$/i.test(u)) {
        return `${u} Floor ${floorDigits}`;
    }
    return `${u} Floor ${floorDigits}`;
}

/**
 * Pairs "APARTAMENTI &lt;id&gt;" with the nearest following "KATI &lt;floor&gt;" in the page text.
 */
function extractAlbanianApartmentNameFromText(text: string, logger?: serverLogger): string | null {
    if (!text?.trim()) {
        return null;
    }

    const collapsed = text.replace(/\s+/g, ' ');
    const tightPatterns = [
        /(?:NJESI\s+BANIMI[_\s]+)?APARTAMENTI\s+([A-Z]?[-]?\d+)[_\s]+KATI\s+(-?\d+)/i,
        /APARTAMENTI\s+([A-Z]?[-]?\d+)[_\s]+KATI\s+(-?\d+)/i,
        /(?:NJ[ËE]SI\s+BANIMI[_\s]+)?APARTAMENTI\s+([A-Z]?[-]?\d+)[_\s]+KATI\s+(-?\d+)/i
    ];
    for (const pattern of tightPatterns) {
        const match = collapsed.match(pattern);
        if (match?.[1] != null && match?.[2] != null) {
            const name = formatAlbanianUnitDisplayName(match[1], match[2]);
            logger?.debug(`Extracted name from tight Albanian pattern: ${name}`);
            return name;
        }
    }

    const apartRe = /APARTAMENTI\s+([^\s\r\n]+)/gi;
    let apartMatch: RegExpExecArray | null;
    while ((apartMatch = apartRe.exec(text)) !== null) {
        const unitTok = apartMatch[1];
        const afterLabel = apartMatch.index + apartMatch[0].length;
        const windowText = text.slice(afterLabel, afterLabel + APARTAMENTI_KATI_SEARCH_WINDOW);
        const katiMatch = windowText.match(/KATI\s+(-?\d+)/i);
        if (katiMatch?.[1] != null) {
            const name = formatAlbanianUnitDisplayName(unitTok, katiMatch[1]);
            logger?.debug(`Extracted name from windowed APARTAMENTI…KATI: ${name}`);
            return name;
        }
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    for (let i = 0; i < lines.length; i += 1) {
        const lineUnit = lines[i].match(/^APARTAMENTI\s+([^\s]+)\s*$/i);
        if (!lineUnit?.[1]) {
            continue;
        }
        for (let j = i + 1; j < Math.min(i + 12, lines.length); j += 1) {
            const kRow = lines[j].match(/KATI\s+(-?\d+)/i);
            if (kRow?.[1] != null) {
                const name = formatAlbanianUnitDisplayName(lineUnit[1], kRow[1]);
                logger?.debug(`Extracted name from line-pair APARTAMENTI / KATI: ${name}`);
                return name;
            }
        }
    }

    return null;
}

/**
 * Simple parser for floor plan data (no image extraction, just text parsing)
 */
function parseFloorPlanDataSimple(
    text: string,
    logger?: serverLogger
): {
    name: string;
    netArea: number;
    sharedArea: number;
    totalArea: number;
    verandaArea: number;
} {
    // Extract name - handle both OCR and Ghostscript formats
    let name = 'Unknown Unit';
    if (text && text.trim().length > 0) {
        const albanianName = extractAlbanianApartmentNameFromText(text, logger);
        if (albanianName) {
            name = albanianName;
        }

        if (name === 'Unknown Unit') {
            // Legacy: same-line KATI (fragmented OCR)
            const normalizedText = text.replace(/\s+/g, ' ').replace(/[_\s]+/g, ' ');
            const looseLine = /([A-Z]?[-]?\d+)[_\s]+KATI\s+(-?\d+)/i.exec(normalizedText);
            if (looseLine?.[1] != null && looseLine[2] != null) {
                name = formatAlbanianUnitDisplayName(looseLine[1], looseLine[2]);
                logger?.debug(`Extracted name from inline id+KATI: ${name}`);
            }
        }

        if (name === 'Unknown Unit') {
            // Try to find name in lines (skip header lines, look for unit patterns)
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            for (const line of lines) {
                if (/APARTAMENTI|NJ[ËE]SI|KATI/i.test(line) && line.length < 100) {
                    const match = line.match(/([A-Z]?[-]?\d+)[_\s]+KATI\s+(-?\d+)/i);
                    if (match && match[1] && match[2]) {
                        name = formatAlbanianUnitDisplayName(match[1], match[2]);
                        logger?.debug(`Extracted name from line: ${name}`);
                        break;
                    }
                }
            }

            // Fallback: use first substantial line
            if (name === 'Unknown Unit' && lines.length > 0) {
                const firstLine = lines.find(l => l.length >= 2 && l.length < 100 && !/^\d+[\s\d]*$/.test(l));
                if (firstLine) {
                    name = firstLine;
                }
            }
        }
    }
    
    // Extract areas - handle both formats:
    // OCR format: "SIPERFAQE NETO: 97.46 m2" (on same line)
    // Ghostscript format: "SIPERFAQE NETO:" on one line, "97.46 m" on next line
    // Normalize text first to merge label:value pairs that might be on separate lines
    const normalizedText = text.replace(/:\s*\n\s*(\d+[.,]?\d*\s*m[²2']?)/gi, ': $1');
    
    const netArea = extractAreaSimple(normalizedText, [
        /siperfaqe\s+neto[:\s]+(\d+[.,]?\d*)\s*m[²2']?/i,
        /siperfaqe\s+neto[:\s]+(\d+[.,]?\d*)/i,
        /(?:net|bruto|usable)\s*area[:\s]*(\d+[.,]?\d*)\s*m[²2']?/i,
        /neto[:\s]+(\d+[.,]?\d*)\s*m[²2']?/i
    ], logger);
    
    const sharedArea = extractAreaSimple(normalizedText, [
        /siperfaqe\s+e\s+perbashket[:\s]+(\d+[.,]?\d*)\s*m[²2'n]?/i,
        /siperfaqe\s+e\s+perbashket[:\s]+(\d+[.,]?\d*)/i,
        /(?:shared|common|joint)\s*area[:\s]*(\d+[.,]?\d*)\s*m[²2']?/i,
        /perbashket[:\s]+(\d+[.,]?\d*)\s*m[²2']?/i
    ], logger);
    
    const totalArea = extractAreaSimple(normalizedText, [
        /sperfaqetotale[:\s]+(\d+[.,]?\d*)/i,
        /siperfaqe\s+totale[:\s]+(\d+[.,]?\d*)\s*m[²2']?/i,
        /(?:total|gross|brutto)\s*area[:\s]*(\d+[.,]?\d*)\s*m[²2']?/i,
        /totale[:\s]+(\d+[.,]?\d*)\s*m[²2']?/i
    ], logger);

    const verandaArea = extractAreaSimple(normalizedText, [
        /veranda?[:\s]+(\d+[.,]?\d*)\s*m[²2']?/i,
        /veranda?[:\s]+(\d+[.,]?\d*)/i
    ], logger);

    const finalTotalArea = totalArea > 0 ? totalArea : (netArea + sharedArea > 0 ? netArea + sharedArea : 0);

    return { name, netArea, sharedArea, totalArea: finalTotalArea, verandaArea };
}

function extractAreaSimple(text: string, patterns: RegExp[], logger?: serverLogger): number {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(value) && value > 0) {
                return value;
            }
        }
    }
    return 0;
}

function calculateConfidenceSimple(parsedData: {name: string; netArea: number; sharedArea: number; totalArea: number}, textLength: number): number {
    let confidence = 0;
    if (parsedData.name !== 'Unknown Unit') confidence += 20;
    if (parsedData.netArea > 0) confidence += 25;
    if (parsedData.sharedArea > 0) confidence += 15;
    if (parsedData.totalArea > 0) confidence += 20;
    if (textLength > 100) confidence += 20;
    return Math.min(100, confidence);
}

/**
 * Performs OCR on an image buffer using Tesseract.js
 */
async function performOCR(
    imageBuffer: Buffer,
    language: string = 'eng',
    logger?: serverLogger
): Promise<{text: string; confidence: number}> {
    let worker: Worker | null = null;
    
    try {
        logger?.debug('Initializing Tesseract OCR worker...');
        worker = await createWorker(language);
        
        // Preprocess image for better OCR results
        const processedImage = await preprocessImageForOCR(imageBuffer, logger);
        
        logger?.debug('Performing OCR on image...');
        const result = await worker.recognize(processedImage);
        
        // Handle different tesseract.js response structures
        const ocrData: any = (result as any).data || result;

        return {
            text: (ocrData.text || '').trim(),
            confidence: ocrData.confidence || 0
        };
    } catch (error) {
        logger?.err('Error performing OCR', error);
        throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }
}

/**
 * Preprocesses an image to improve OCR accuracy
 */
async function preprocessImageForOCR(
    imageBuffer: Buffer,
    logger?: serverLogger
): Promise<Buffer> {
    try {
        const metadata = await sharp(imageBuffer).metadata();
        
        // Ensure minimum size for OCR (Tesseract works better with larger images)
        const minWidth = 300;
        const minHeight = 300;
        
        let processed = sharp(imageBuffer)
            .greyscale() // Convert to grayscale
            .normalize() // Enhance contrast
            .sharpen(); // Sharpen edges
        
        // Resize if too small
        if (metadata.width && metadata.height) {
            if (metadata.width < minWidth || metadata.height < minHeight) {
                const scale = Math.max(minWidth / metadata.width, minHeight / metadata.height);
                processed = processed.resize(
                    Math.round(metadata.width * scale),
                    Math.round(metadata.height * scale),
                    {kernel: sharp.kernel.lanczos3}
                );
                logger?.debug(`Resized image from ${metadata.width}x${metadata.height} for better OCR`);
            }
        }
        
        return await processed.png().toBuffer();
    } catch (error) {
        logger?.warn('Image preprocessing failed, using original image', error);
        return imageBuffer;
    }
}

/**
 * Parses structured data from extracted text (full version from utilities)
 * Uses regex patterns to find: name, net area, shared area, total area
 */
function parseFloorPlanData(
    text: string,
    logger?: serverLogger
): {
    name: string;
    netArea: number;
    sharedArea: number;
    totalArea: number;
    verandaArea: number;
} {
    // Extract name
    const name = extractNameFull(text, logger);

    // Extract areas using regex patterns (Albanian and English, handling OCR errors)
    const netArea = extractAreaFull(text, [
        /siperfaqe\s+neto[:\s]+(\d+[.,]?\d*)\s*m[²2?]/i,
        /siperfaqe\s+neto[:\s]+(\d+[.,]?\d*)/i,
        /(?:net|bruto|usable)\s*area[:\s]*(\d+[.,]?\d*)\s*m[²2?]/i,
        /(?:net|bruto|usable)\s*area[:\s]*(\d+[.,]?\d*)/i,
        /neto[:\s]+(\d+[.,]?\d*)\s*m[²2?]/i
    ], 'net', logger);

    const sharedArea = extractAreaFull(text, [
        /siperfaqe\s+e\s+perbashket[:\s]+(\d+[.,]?\d*)\s*m[²2?n]/i,
        /siperfaqe\s+e\s+perbashket[:\s]+(\d+[.,]?\d*)/i,
        /(?:shared|common|joint)\s*area[:\s]*(\d+[.,]?\d*)\s*m[²2?]/i,
        /(?:shared|common|joint)\s*area[:\s]*(\d+[.,]?\d*)/i,
        /perbashket[:\s]+(\d+[.,]?\d*)\s*m[²2?]/i
    ], 'shared', logger);

    const totalArea = extractAreaFull(text, [
        /sperfaqetotale[:\s]+(\d+[.,]?\d*)/i,
        /siperfaqe\s+totale[:\s]+(\d+[.,]?\d*)\s*m[²2?]/i,
        /siperfaqe\s+totale[:\s]+(\d+[.,]?\d*)/i,
        /(?:total|gross|brutto)\s*area[:\s]*(\d+[.,]?\d*)\s*m[²2?]/i,
        /(?:total|gross|brutto)\s*area[:\s]*(\d+[.,]?\d*)/i,
        /totale[:\s]+(\d+[.,]?\d*)\s*m[²2?]/i
    ], 'total', logger);

    const verandaArea = extractAreaFull(text, [
        /veranda?[:\s]+(\d+[.,]?\d*)\s*m[²2?]/i,
        /veranda?[:\s]+(\d+[.,]?\d*)/i
    ], 'veranda', logger);

    // If total area not found, calculate from net + shared
    const calculatedTotal = netArea + sharedArea;
    const finalTotalArea = totalArea > 0 ? totalArea : (calculatedTotal > 0 ? calculatedTotal : 0);

    return {
        name,
        netArea,
        sharedArea,
        totalArea: finalTotalArea,
        verandaArea
    };
}

/**
 * Extracts unit name from text (full version from utilities)
 */
function extractNameFull(text: string, logger?: serverLogger): string {
    if (!text || text.trim().length === 0) {
        return 'Unknown Unit';
    }

    const albanianName = extractAlbanianApartmentNameFromText(text, logger);
    if (albanianName) {
        return albanianName;
    }

    // Split into lines and get first few non-empty lines
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 10);

    // Look for patterns like "2+1", "K2", "Unit 2", etc.
    for (const line of lines) {
        const unitPattern = /(\d+\+\d+[\s\d]*[A-Z]?\d*|[A-Z]?\d+[\s\d]*[A-Z]?\d*)/i;
        const match = line.match(unitPattern);
        if (match && match[0].length >= 2) {
            logger?.debug(`Extracted name from pattern: ${match[0]}`);
            return match[0].trim();
        }
    }

    // Fallback: use first substantial line
    const firstLine = lines[0];
    if (firstLine && firstLine.length >= 2 && firstLine.length < 100) {
        logger?.debug(`Using first line as name: ${firstLine}`);
        return firstLine;
    }

    logger?.warn('Could not extract unit name, using default');
    return 'Unknown Unit';
}

/**
 * Extracts area value from text using regex patterns (full version from utilities)
 */
function extractAreaFull(
    text: string,
    patterns: RegExp[],
    areaType: string,
    logger?: serverLogger
): number {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            // Handle both comma and dot as decimal separator
            const valueStr = match[1].replace(',', '.');
            const value = parseFloat(valueStr);
            
            if (!isNaN(value) && value > 0) {
                logger?.debug(`Extracted ${areaType} area: ${value} m²`);
                return value;
            }
        }
    }

    logger?.debug(`Could not extract ${areaType} area`);
    return 0;
}

/**
 * Calculates confidence score based on extracted data quality (full version from utilities)
 */
function calculateConfidenceFull(
    parsedData: {name: string; netArea: number; sharedArea: number; totalArea: number},
    ocrConfidence: number,
    textLength: number
): number {
    let score = 0;
    let factors = 0;

    // Name extraction (30 points)
    if (parsedData.name && parsedData.name !== 'Unknown Unit') {
        score += 30;
    }
    factors++;

    // Net area extraction (25 points)
    if (parsedData.netArea > 0) {
        score += 25;
    }
    factors++;

    // Shared area extraction (15 points)
    if (parsedData.sharedArea > 0) {
        score += 15;
    }
    factors++;

    // Total area extraction (20 points)
    if (parsedData.totalArea > 0) {
        score += 20;
    }
    factors++;

    // Text quality (10 points)
    if (textLength > 100) {
        score += 10;
    } else if (textLength > 50) {
        score += 5;
    }
    factors++;

    // OCR confidence (if used)
    if (ocrConfidence > 0) {
        score += (ocrConfidence / 100) * 10;
    }

    return Math.min(100, Math.round(score));
}

/**
 * Extracts floor plan data from an image buffer using OCR only
 * This is the function used by saveOcrDataFromBuffer and saveOcrDataForImage
 */
export async function extractFloorPlanDataFromImage(
    imageBuffer: Buffer,
    logger?: serverLogger
): Promise<ExtractedImageOcrData> {
    try {
        logger?.start('Extracting floor plan data from image via OCR...');

        const ocrResult = await performOCR(imageBuffer, 'eng', logger);
        const parsedData = parseFloorPlanData(ocrResult.text, logger);
        const confidence = calculateConfidenceFull(parsedData, ocrResult.confidence, ocrResult.text.length);

        logger?.finish(`OCR extraction completed with confidence: ${confidence.toFixed(2)}%`);

        return {
            name: parsedData.name,
            netArea: parsedData.netArea,
            sharedArea: parsedData.sharedArea,
            totalArea: parsedData.totalArea,
            verandaArea: parsedData.verandaArea,
            rawText: ocrResult.text,
            confidence,
            metadata: {
                extractionMethod: 'ocr'
            }
        };
    } catch (error) {
        logger?.err('Error extracting floor plan data from image', error);
        throw new Error(`Image OCR extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Saves OCR data extracted from an image buffer (faster - uses in-memory image)
 */
export async function saveOcrDataFromBuffer(
    imageBuffer: Buffer,
    outputFolder: string,
    pageNumber: number,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Promise<ExtractedImageOcrData> {
    return await timer.timeAsync('saveOcrDataFromBuffer', async () => {
        const logger = getLogger("ocr_image_buffer", parentLogger);
        logger.start(`Extracting OCR data from image buffer...`);
        const ocrData = await extractFloorPlanDataFromImage(imageBuffer);

        const jsonPath = path.join(outputFolder, `page-${pageNumber}-ocr.json`);
        const textPath = path.join(outputFolder, `page-${pageNumber}-ocr.txt`);

        fs.writeFileSync(
            jsonPath,
            JSON.stringify(
                {
                    name: ocrData.name,
                    netArea: ocrData.netArea,
                    sharedArea: ocrData.sharedArea,
                    totalArea: ocrData.totalArea,
                    verandaArea: ocrData.verandaArea,
                    confidence: ocrData.confidence,
                    rawTextLength: ocrData.rawText.length,
                    metadata: ocrData.metadata
                },
                null,
                2
            ),
            'utf-8'
        );
        fs.writeFileSync(textPath, ocrData.rawText, 'utf-8');

        logger.finish(`Finished extracting OCR data from image buffer!`);

        return ocrData;
    });
}

/**
 * Saves OCR data extracted from an image file (slower, use saveOcrDataFromBuffer when possible)
 */
export async function saveOcrDataForImage(
    imagePath: string,
    outputFolder: string,
    pageNumber: number,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Promise<ExtractedImageOcrData> {
    return await timer.timeAsync('saveOcrDataForImage', async () => {
        const logger = getLogger("ocr_image_to_json", parentLogger);
        logger.start(`Extracting OCR data from image...`);
        const imageBuffer = fs.readFileSync(imagePath);
        const ocrData = await extractFloorPlanDataFromImage(imageBuffer);

        const jsonPath = path.join(outputFolder, `page-${pageNumber}-ocr.json`);
        const textPath = path.join(outputFolder, `page-${pageNumber}-ocr.txt`);

        fs.writeFileSync(
            jsonPath,
            JSON.stringify(
                {
                    name: ocrData.name,
                    netArea: ocrData.netArea,
                    sharedArea: ocrData.sharedArea,
                    totalArea: ocrData.totalArea,
                    verandaArea: ocrData.verandaArea,
                    confidence: ocrData.confidence,
                    rawTextLength: ocrData.rawText.length,
                    metadata: ocrData.metadata
                },
                null,
                2
            ),
            'utf-8'
        );
        fs.writeFileSync(textPath, ocrData.rawText, 'utf-8');

        logger.finish(`Finished extracting OCR data from image!`);

        return ocrData;
    });
}
