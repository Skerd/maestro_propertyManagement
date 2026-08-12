import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer";
import sharp from "sharp";
import {HorizontalSegment, LineDetection, Rectangle, VerticalSegment} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types";
import {generateColorForIndex, generateLineColor} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/colorUtils";
import {config} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/config";
import {detectLinesFromBuffer} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/lineDetectionUtils";
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {collapseRepeatedPhrases} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/pdfTextBboxFilterUtils';

export function rotationNeededToLandscapeTheImage(pngWidth: number, pngHeight: number, displayWidthPts: number, displayHeightPts: number, DPI: number): number {
    // 72 is the dots per inch
    // px = pt * (DPI / 72)
    const expectW = Math.max(1, Math.round((displayWidthPts * DPI) / 72));
    const expectH = Math.max(1, Math.round((displayHeightPts * DPI) / 72));
    const tolerance = Math.max(4, Math.round(DPI / 100));

    if (Math.abs(pngWidth - expectW) <= tolerance && Math.abs(pngHeight - expectH) <= tolerance) {
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

export async function boostImageMaxInMemory(input: Buffer | string, parentLogger: serverLogger, timer: PerformanceTimer, boostedOutputPath: string): Promise<Buffer> {
    return await timer.timeAsync('boostImageMaxInMemory', async () => {
        const logger = getLogger("boost_image_max_in_memory", parentLogger);
        logger.start("Boosting image...");

        logger.debug("Boosting image in memory...");
        const boostedBuffer = await sharp(input)
            .grayscale()
            .threshold(config.LINE_INK_THRESHOLD)
            .gamma(3)
            .modulate({ brightness: 3, saturation: 5, hue: -360, lightness: -57 })
            .gamma(3)
            .linear(2.6765, -114.20)
            .sharpen({ sigma: 10, m1: 0, m2: 10 })
            .png()
            .toBuffer();
        logger.debug("Finished boosting image in memory!");

        logger.debug("Saving boosted image in disk for debugging purposes...");
        await sharp(boostedBuffer).toFile(boostedOutputPath);
        logger.debug("Finished saving image in disk for debugging purposes!");

        logger.finish("Finished boosting image!");
        return boostedBuffer;
    });
}

export function buildOverlaySvg(width: number, height: number, horizontals: HorizontalSegment[], verticals: VerticalSegment[]): string {
    let lineIndex = 0;
    const horizontalMarkup = horizontals.map((segment) => {
        return `<line 
                    x1="${segment.xStart}" 
                    y1="${segment.y}" 
                    x2="${segment.xEnd}" 
                    y2="${segment.y}" 
                    stroke="${generateLineColor(lineIndex++)}" 
                    stroke-width="${config.OVERLAY_LINE_THICKNESS}" 
                    stroke-linecap="square" 
                />`;
    }).join('');
    const verticalMarkup = verticals.map((segment) => {
        return `<line 
                    x1="${segment.x}" 
                    y1="${segment.yStart}" 
                    x2="${segment.x}" 
                    y2="${segment.yEnd}" 
                    stroke="${generateLineColor(lineIndex++)}" 
                    stroke-width="${config.OVERLAY_LINE_THICKNESS}" 
                    stroke-linecap="square" 
                />`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${horizontalMarkup}${verticalMarkup}</svg>`;
}

export function buildRectanglesOverlaySvg(width: number, height: number, rectangles: Rectangle[], centerRect: Rectangle | null, topRightRect: Rectangle | null): string {
    const rectMarkup = rectangles.map((rect, index) => {
        const isCenter = centerRect &&
            Math.abs(rect.left - centerRect.left) <= config.RECT_DEDUP_TOLERANCE &&
            Math.abs(rect.right - centerRect.right) <= config.RECT_DEDUP_TOLERANCE &&
            Math.abs(rect.top - centerRect.top) <= config.RECT_DEDUP_TOLERANCE &&
            Math.abs(rect.bottom - centerRect.bottom) <= config.RECT_DEDUP_TOLERANCE;
        const isTopRight = topRightRect &&
            Math.abs(rect.left - topRightRect.left) <= config.RECT_DEDUP_TOLERANCE &&
            Math.abs(rect.right - topRightRect.right) <= config.RECT_DEDUP_TOLERANCE &&
            Math.abs(rect.top - topRightRect.top) <= config.RECT_DEDUP_TOLERANCE &&
            Math.abs(rect.bottom - topRightRect.bottom) <= config.RECT_DEDUP_TOLERANCE;

        let strokeColor: string;
        let strokeWidth: number;
        let fillColor: string;

        if (isCenter) {
            strokeColor = '#00ff00';
            strokeWidth = 4;
            fillColor = 'rgba(0, 255, 0, 0.2)';
        } else if (isTopRight) {
            strokeColor = '#ff0000';
            strokeWidth = 4;
            fillColor = 'rgba(255, 0, 0, 0.2)';
        } else {
            // Use unique color for each rectangle
            const colors = generateColorForIndex(index, rectangles.length);
            strokeColor = colors.stroke;
            strokeWidth = 2;
            fillColor = colors.fill;
        }

        return `<rect 
                    x="${rect.left}" 
                    y="${rect.top}" 
                    width="${rect.width}" 
                    height="${rect.height}" 
                    stroke="${strokeColor}" 
                    stroke-width="${strokeWidth}" 
                    fill="${fillColor}" 
                />`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rectMarkup}</svg>`;
}

export async function detectImageLines(input: Buffer, outputPath: string, parentLogger: serverLogger, timer: PerformanceTimer): Promise<LineDetection> {
    return await timer.timeAsync('overlayDetectedLines', async () => {

        const logger = getLogger("overlay_detected_lines", parentLogger);
        logger.start("Detecting image lines...");
        logger.debug("Detecting lines from image buffer...");
        const detection =  await detectLinesFromBuffer(input, logger, timer);
        logger.debug("Finished detecting lines from image buffer!");

        logger.debug("Building overlay svg...");
        const svgOverlay = buildOverlaySvg(detection.width, detection.height, detection.horizontals, detection.verticals);
        await sharp(input).composite([{input: Buffer.from(svgOverlay), blend: 'over'}]).png().toFile(outputPath);
        logger.debug("Finished building overlay svg!");

        logger.finish("Finished detecting lines!");
        return detection;
    });
}

/**
 * Normalizes Ghostscript txtwrite output to match OCR formatting
 * Removes excessive spaces, normalizes whitespace, filters coordinates, and groups labels with values
 */
function normalizeGhostscriptText(text: string): string {
    if (!text) return '';

    // Split into lines and process each line
    const lines = text.split(/\r?\n/);
    const normalizedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        // Replace multiple spaces with single space
        line = line.replace(/\s+/g, ' ').trim();

        if (line.length === 0) continue;

        // Skip lines that are just coordinates/numbers (not meaningful text)
        const hasLetters = /[a-zA-Z]/.test(line);
        const isNumberOnly = /^\d+[\s\d]*$/.test(line);
        const isCoordinateLike = /^[\d\s\.\+\-°]+$/.test(line) && line.split(/\s+/).length > 3;
        const isShortNumber = /^\d+$/.test(line) && line.length <= 3; // Keep short numbers (might be page numbers, etc.)

        // Skip coordinate-like lines, but keep text lines and short numbers
        if (!hasLetters && (isNumberOnly || isCoordinateLike) && !isShortNumber) {
            continue;
        }

        // Remove coordinates/numbers that appear before labels
        // Pattern: numbers followed by label (e.g., "665 434 341 2828 SIPERFAQE E PERBASHKET:")
        if (/^\d+[\s\d]+[A-Z]/i.test(line)) {
            // Extract just the text part (after coordinates)
            const textMatch = line.match(/([A-Z][^:]*:?)/i);
            if (textMatch) {
                line = textMatch[0];
            }
        }

        // Remove duplicate repeated labels (e.g., "SIPERFAQE NETO:SIPERFAQE NETO:SIPËRFAQE NETO:")
        // Keep only the first occurrence
        if (line.includes(':')) {
            const parts = line.split(':');
            if (parts.length > 2) {
                // Check if all parts before last are similar (duplicates)
                const firstPart = parts[0].trim();
                const allSimilar = parts.slice(0, -1).every(p => {
                    const normalized = p.trim().toLowerCase().replace(/[ëê]/g, 'e').replace(/\s+/g, '');
                    return normalized === firstPart.toLowerCase().replace(/[ëê]/g, 'e').replace(/\s+/g, '');
                });
                if (allSimilar) {
                    line = firstPart + ':' + (parts[parts.length - 1] || '');
                }
            }
        }

        // Try to merge labels with their values (check both directions)
        // Case 1: Current line is a value, next line is a label ending with ":"
        if (/^\d+[.,]?\d*\s*m[²2']?/i.test(line) && i + 1 < lines.length) {
            const nextLine = lines[i + 1].replace(/\s+/g, ' ').trim();
            if (nextLine.endsWith(':') && /SIPERFAQE|AREA/i.test(nextLine)) {
                // Merge: label + value
                line = nextLine + ' ' + line;
                i++; // Skip the next line since we merged it
            }
        }
        // Case 2: Current line ends with ":" and next line is a value
        else if (line.endsWith(':') && i + 1 < lines.length) {
            const nextLine = lines[i + 1].replace(/\s+/g, ' ').trim();
            // Check if next line looks like a value (number with optional unit)
            if (/^\d+[.,]?\d*\s*m[²2']?/i.test(nextLine)) {
                line = line + ' ' + nextLine;
                i++; // Skip the next line since we merged it
            }
        }

        normalizedLines.push(collapseRepeatedPhrases(line));
    }

    // Join lines with single newline (like OCR output)
    return normalizedLines.join('\n');
}

export function batchExtractTextWithGhostscript(
    inputPath: string,
    firstPage: number,
    lastPage: number,
    outputDir: string,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Map<number, string> {
    return timer.timeSync('batchExtractTextWithGhostscript', () => {
        const logger = getLogger('batch_extract_text_ghostscript', parentLogger);
        logger.start(`Batch extracting text from pages ${firstPage}-${lastPage} using Ghostscript txtwrite...`);

        const outputPattern = path.join(outputDir, `_gs_text_%d.txt`);
        const result = new Map<number, string>();

        try {
            const flags = [
                '-dNOPAUSE',
                '-dBATCH',
                '-dSAFER',
                '-q',
                '-sDEVICE=txtwrite',
                `-dFirstPage=${firstPage}`,
                `-dLastPage=${lastPage}`,
                `-sOutputFile=${outputPattern}`,
                inputPath,
            ];
            execFileSync('gs', flags, { stdio: 'ignore' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`Batch GS txtwrite failed: ${msg}`);
            return result;
        }

        // GS names files by iteration count (1-based from firstPage)
        let iteration = 1;
        for (let page = firstPage; page <= lastPage; page++) {
            const filePath = path.join(outputDir, `_gs_text_${iteration}.txt`);
            if (fs.existsSync(filePath)) {
                try {
                    const raw = fs.readFileSync(filePath, 'utf-8');
                    fs.unlinkSync(filePath);
                    result.set(page, normalizeGhostscriptText(raw).trim());
                } catch {
                    result.set(page, '');
                }
            }
            iteration++;
        }

        logger.finish(`Batch GS txtwrite complete. Got text for ${result.size}/${lastPage - firstPage + 1} pages.`);
        return result;
    });
}