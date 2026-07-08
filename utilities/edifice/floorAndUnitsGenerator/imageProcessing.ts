import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from './config';
import {
    generateColorForIndex,
    generateLineColor
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/colorUtils';
import {detectLinesFromBuffer} from './lineDetection';
import type {HorizontalSegment, LineDetection, Rectangle, VerticalSegment} from './types';

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
        
        normalizedLines.push(line);
    }
    
    // Join lines with single newline (like OCR output)
    return normalizedLines.join('\n');
}

/**
 * Extracts text from PDF using Ghostscript's txtwrite device
 * Works on vectorized PDFs where text is rendered as paths/curves
 * 
 * @param inputPath - Path to PDF file
 * @param pageNumber - Page number (1-indexed)
 * @param parentLogger - Logger instance
 * @param timer - Performance timer
 * @returns Extracted text string
 */
export function extractTextWithGhostscript(
    inputPath: string,
    pageNumber: number,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): string {
    return timer.timeSync('extractTextWithGhostscript', () => {
        const logger = getLogger("extract_text_ghostscript", parentLogger);
        logger.start(`Extracting text from page ${pageNumber} using Ghostscript txtwrite...`);
        
        // Create temp file for text output
        const tempTextFile = path.join(path.dirname(inputPath), `_temp_text_${pageNumber}.txt`);
        
        try {
            const flags = [
                '-dNOPAUSE',
                '-dBATCH',
                '-dSAFER',
                '-q',
                '-sDEVICE=txtwrite',
                `-dFirstPage=${pageNumber}`,
                `-dLastPage=${pageNumber}`,
                `-sOutputFile=${tempTextFile}`,
                inputPath
            ];
            
            execFileSync('gs', flags, { stdio: 'ignore' });
            
            // Read extracted text
            if (fs.existsSync(tempTextFile)) {
                let text = fs.readFileSync(tempTextFile, 'utf-8');
                fs.unlinkSync(tempTextFile); // Clean up temp file
                
                // Normalize text formatting to match OCR output
                // Ghostscript txtwrite often outputs text with excessive spaces
                text = normalizeGhostscriptText(text);
                
                logger.debug(`Extracted ${text.length} characters using Ghostscript txtwrite`);
                logger.finish("Finished extracting text with Ghostscript!");
                return text.trim();
            } else {
                logger.warn('Ghostscript txtwrite did not produce output file');
                return '';
            }
        } catch (error) {
            // Clean up temp file if it exists
            if (fs.existsSync(tempTextFile)) {
                try {
                    fs.unlinkSync(tempTextFile);
                } catch {
                    // Ignore cleanup errors
                }
            }
            
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.warn(`Ghostscript text extraction failed: ${errorMsg}`);
            return '';
        }
    });
}

/**
 * Gets optimized Ghostscript flags for rendering
 * @param useDarkVectors - If true, adds -dBlackVector=true for darker vectors (better for line detection)
 */
function getGhostscriptFlags(resolution: number, firstPage?: number, lastPage?: number, useDarkVectors: boolean = false): string[] {
    // Base flags for all modes
    const baseFlags = [
        '-dNOPAUSE',
        '-dBATCH',
        '-dSAFER',
        '-q',
        '-dNumRenderingThreads=4',        // Enable multithreading (optimal per Ghostscript docs)
        '-dMaxBitmap=500000000',           // Optimize memory (500MB)
        '-dBufferSpace=16777216',          // 16MB buffer (optimal per docs)
        `-sDEVICE=png16m`,                 // 24-bit PNG (faster than pngalpha, no alpha needed)
        `-r${resolution}`,
    ];
    
    // Add dark vector flag only if requested (for line detection)
    if (useDarkVectors) {
        baseFlags.push('-dBlackVector=true');  // Force vector graphics to be rendered as black (makes vectors darker)
    }
    
    // Add page range if specified
    if (firstPage !== undefined && lastPage !== undefined) {
        baseFlags.push(`-dFirstPage=${firstPage}`, `-dLastPage=${lastPage}`);
    }
    
    const perfFlags = [
        '-dNOINTERPOLATE',
        '-dGraphicsAlphaBits=1',
        '-dTextAlphaBits=1',
        '-dUseFastColor=true',
        '-dCOLORSCREEN=false',
        '-dUseCropBox',
        '-dNOCIE',
    ];

    return [...baseFlags, ...perfFlags];
}

/**
 * Renders a PDF page to PNG with Ghostscript (optimized for speed).
 * @param useDarkVectors - If true, renders with -dBlackVector=true for darker vectors (better for line detection)
 */
export function renderPageToPng(
    inputPath: string,
    pageNumber: number,
    outputPath: string,
    parentLogger: serverLogger,
    timer: PerformanceTimer,
    useDarkVectors: boolean = false
): void {
    timer.timeSync('renderPageToPng', () => {
        const logger = getLogger('render_page_to_png', parentLogger);
        const mode = useDarkVectors ? 'dark (for line detection)' : 'light (for cropping)';
        logger.start(`Rendering page ${pageNumber} to ${outputPath} using Ghostscript (${mode})`);

        const resolution = Math.round(config.DEFAULT_DPI * config.DEFAULT_SCALE);

        const flags = [
            ...getGhostscriptFlags(resolution, pageNumber, pageNumber, useDarkVectors),
            `-sOutputFile=${outputPath}`,
            inputPath
        ];

        execFileSync('gs', flags, { stdio: 'ignore' });
        logger.finish('Finished rendering page!');
    });
}

/**
 * Full-page PDF raster at the given DPI for crop export: CropBox, no fast-mode hacks (cleaner vectors than preview).
 */
export function renderPdfPageRasterForDetailExport(
    inputPath: string,
    pageNumber: number,
    outputPath: string,
    rasterDpi: number,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): void {
    timer.timeSync('renderPdfPageRasterForDetailExport', () => {
        const logger = getLogger('render_pdf_detail_export', parentLogger);
        const r = Math.max(72, Math.round(rasterDpi));
        logger.start(`Detail-export raster page ${pageNumber} @ ${r} DPI`);
        const flags = [
            '-dNOPAUSE',
            '-dBATCH',
            '-dSAFER',
            '-q',
            '-dNumRenderingThreads=4',
            '-dMaxBitmap=500000000',
            '-dBufferSpace=16777216',
            '-sDEVICE=png16m',
            `-r${r}`,
            `-dFirstPage=${pageNumber}`,
            `-dLastPage=${pageNumber}`,
            '-dUseCropBox',
            `-sOutputFile=${outputPath}`,
            inputPath,
        ];
        execFileSync('gs', flags, { stdio: 'ignore' });
        logger.finish('Detail-export raster finished');
    });
}

/**
 * Boosts image contrast and brightness in memory (no disk I/O).
 * Accepts a Buffer (preferred, avoids disk re-read) or a file path string.
 * Returns the boosted image as a Buffer via a single sharp pipeline pass.
 */
export async function boostImageMaxInMemory(input: Buffer | string, parentLogger: serverLogger, timer: PerformanceTimer, boostedOutputPath: string): Promise<Buffer> {
    return await timer.timeAsync('boostImageMaxInMemory', async () => {
        const logger = getLogger("boost_image_max_in_memory", parentLogger);
        logger.start("Boosting image in memory...");

        const boostedBuffer = await sharp(input)
            .grayscale()
            .gamma(3)
            .modulate({ brightness: 3, saturation: 5, hue: -360, lightness: -57 })
            .gamma(3)
            .linear(2.6765, -114.20)
            .sharpen({ sigma: 10, m1: 0, m2: 10 })
            .png()
            .toBuffer();

        if (config.SAVE_BOOSTED_IMAGE) {
            await sharp(boostedBuffer).toFile(boostedOutputPath);
        }
        logger.finish("Finished boosting image in memory!");
        return boostedBuffer;
    });
}


/**
 * Overlays detected lines on an image and returns the detection result
 * @param input - File path (string) or image Buffer for in-memory processing
 * @param outputPath - Optional. If not provided, overlay image won't be saved (faster)
 * @param parentLogger
 * @param timer
 */
export async function overlayDetectedLines(
    input: Buffer,
    outputPath: string,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Promise<LineDetection> {
    return await timer.timeAsync('overlayDetectedLines', async () => {

        const logger = getLogger("overlay_detected_lines", parentLogger);
        logger.start("Detecting image lines...");
        logger.debug("Detecting lines from image buffer...");
        const detection =  await detectLinesFromBuffer(input, logger, timer);
        logger.debug("Finished detecting lines from image buffer!");

        // Only save overlay if output path is provided
        if (config.SAVE_LINES_OVERLAY) {
            logger.debug("Building overlay svg...");
            const svgOverlay = buildOverlaySvg(detection.width, detection.height, detection.horizontals, detection.verticals);
            await sharp(input).composite([{input: Buffer.from(svgOverlay), blend: 'over'}]).png().toFile(outputPath);
            logger.debug("Finished building overlay svg!");
        }
        
        logger.finish("Finished detecting lines!");
        return detection;
    });
}

/**
 * Builds SVG overlay for rectangles
 */
export function buildRectanglesOverlaySvg(
    width: number,
    height: number,
    rectangles: Rectangle[],
    centerRect: Rectangle | null,
    topRightRect: Rectangle | null
): string {
    const rectMarkup = rectangles
        .map((rect, index) => {
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

            return `<rect x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="${fillColor}" />`;
        })
        .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rectMarkup}</svg>`;
}

/**
 * Overlays rectangles on an image
 */
export async function overlayRectangles(
    inputPath: string,
    outputPath: string,
    rectangles: Rectangle[],
    centerRect: Rectangle | null,
    topRightRect: Rectangle | null,
    width: number,
    height: number
): Promise<void> {
    const svgOverlay = buildRectanglesOverlaySvg(width, height, rectangles, centerRect, topRightRect);
    await sharp(inputPath)
        .composite([
            {
                input: Buffer.from(svgOverlay),
                blend: 'over'
            }
        ])
        .png()
        .toFile(outputPath);
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Batch renders multiple PDF pages to PNG files using Ghostscript
 * Much faster than individual page rendering due to reduced process overhead
 *
 * @param inputPath - Path to PDF file
 * @param firstPage - First page number (1-indexed)
 * @param lastPage - Last page number (1-indexed)
 * @param outputPattern - Output file pattern with %d placeholder (e.g., "page-%d.png")
 * @param outputDir - Directory where output files will be created
 * @param parentLogger - Logger instance
 * @param timer - Performance timer
 * @returns Map of page number to output file path
 */
export function renderPagesBatchWithGhostscript(inputPath: string, firstPage: number, lastPage: number, outputPattern: string, outputDir: string, parentLogger: serverLogger, timer: PerformanceTimer): Map<number, string> {
    return timer.timeSync('renderPagesBatchWithGhostscript', () => {
        const logger = getLogger("render_pages_batch_ghostscript", parentLogger);
        logger.start(`Batch rendering pages ${firstPage}-${lastPage} using Ghostscript`);

        // Use lower resolution in fast mode for significant speedup
        const resolution = Math.round(config.DEFAULT_DPI * config.DEFAULT_SCALE);

        // Ghostscript uses %d pattern for page numbers in output filename
        // The pattern should be just the filename (e.g., "page-%d.png")
        // We'll construct the full path by joining outputDir with the pattern
        // Ghostscript will replace %d with the actual page number
        const outputPath = path.join(outputDir, outputPattern);

        const flags = [
            ...getGhostscriptFlags(resolution, firstPage, lastPage),
            `-sOutputFile=${outputPath}`,
            inputPath
        ];

        execFileSync('gs', flags, { stdio: 'ignore' });

        // Build map of page numbers to output file paths
        // IMPORTANT: Ghostscript's %d represents iteration count (1, 2, 3...), NOT page number!
        // So if rendering pages 9-24, it outputs: page-1.png (page 9), page-2.png (page 10), etc.
        const pageToPath = new Map<number, string>();
        let iteration = 1;
        for (let page = firstPage; page <= lastPage; page++) {
            // Replace %d with iteration number (not page number!)
            pageToPath.set(page, path.join(outputDir, outputPattern.replace('%d', String(iteration))));
            iteration++;
        }

        // Verify files actually exist
        let foundCount = 0;
        for (const [page, filePath] of pageToPath.entries()) {
            if (fs.existsSync(filePath)) {
                foundCount++;
            } else {
                logger.warn(`Batch rendered file missing for page ${page}: ${filePath}`);
            }
        }

        logger.finish(`Finished batch rendering ${lastPage - firstPage + 1} pages! Found ${foundCount}/${pageToPath.size} files.`);
        return pageToPath;
    });
}

/**
 * Batch-renders all specified pages at high detail DPI using Ghostscript.
 * Uses clean render flags (no anti-aliasing shortcuts) suitable for crop export.
 * Returns a map of page number → output file path (GS %d iteration naming).
 */
export function renderDetailPagesBatchWithGhostscript(
    inputPath: string,
    firstPage: number,
    lastPage: number,
    outputPattern: string,
    outputDir: string,
    rasterDpi: number,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Map<number, string> {
    return timer.timeSync('renderDetailPagesBatchWithGhostscript', () => {
        const logger = getLogger('render_detail_pages_batch_ghostscript', parentLogger);
        logger.start(`Batch detail rendering pages ${firstPage}-${lastPage} @ ${rasterDpi} DPI`);

        const outputPath = path.join(outputDir, outputPattern);
        const flags = [
            '-dNOPAUSE',
            '-dBATCH',
            '-dSAFER',
            '-q',
            '-dNumRenderingThreads=4',
            '-dMaxBitmap=500000000',
            '-dBufferSpace=16777216',
            '-sDEVICE=png16m',
            `-r${Math.max(72, Math.round(rasterDpi))}`,
            `-dFirstPage=${firstPage}`,
            `-dLastPage=${lastPage}`,
            '-dUseCropBox',
            `-sOutputFile=${outputPath}`,
            inputPath,
        ];
        execFileSync('gs', flags, { stdio: 'ignore' });

        // GS names files by iteration count (1-based from firstPage)
        const pageToPath = new Map<number, string>();
        let iteration = 1;
        for (let page = firstPage; page <= lastPage; page++) {
            pageToPath.set(page, path.join(outputDir, outputPattern.replace('%d', String(iteration))));
            iteration++;
        }

        let found = 0;
        for (const [, fp] of pageToPath) if (fs.existsSync(fp)) found++;
        logger.finish(`Batch detail render done. Found ${found}/${pageToPath.size} files.`);
        return pageToPath;
    });
}

/**
 * Batch-extracts text from all specified pages using a single Ghostscript txtwrite process.
 * Returns a map of page number → normalized text. Empty string when a page yields no text.
 */
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

export function buildOverlaySvg(width: number, height: number, horizontals: HorizontalSegment[], verticals: VerticalSegment[]): string {
    let lineIndex = 0;
    const horizontalMarkup = horizontals.map((segment) => {
        return `<line x1="${segment.xStart}" y1="${segment.y}" x2="${segment.xEnd}" y2="${segment.y}" stroke="${generateLineColor(lineIndex++)}" stroke-width="${config.OVERLAY_LINE_THICKNESS}" stroke-linecap="square" />`;
    }).join('');
    const verticalMarkup = verticals
        .map((segment) => {
            return `<line x1="${segment.x}" y1="${segment.yStart}" x2="${segment.x}" y2="${segment.yEnd}" stroke="${generateLineColor(lineIndex++)}" stroke-width="${config.OVERLAY_LINE_THICKNESS}" stroke-linecap="square" />`;
        }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${horizontalMarkup}${verticalMarkup}</svg>`;
}

