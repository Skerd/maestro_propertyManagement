import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from '../config';
import type {Rectangle} from '../types';

export type TextSpanBBox = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    text: string;
};

function overlaps(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number }
): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Maps a point from pre-landscape-rotate image space into detection space
 * (same convention as sharp.rotate(rotationNeeded) clockwise).
 */
function mapPointThroughLandscapeRotation(
    x: number,
    y: number,
    preW: number,
    preH: number,
    rotationNeeded: number
): { x: number; y: number } {
    const rot = ((rotationNeeded % 360) + 360) % 360;
    if (rot === 0) return { x, y };
    if (rot === 180) return { x: preW - x, y: preH - y };
    if (rot === 90) return { x: preH - y, y: x };
    if (rot === 270) return { x: y, y: preW - x };
    return { x, y };
}

function mapRectThroughLandscapeRotation(
    rect: { left: number; top: number; right: number; bottom: number },
    preW: number,
    preH: number,
    rotationNeeded: number
): { left: number; top: number; right: number; bottom: number } {
    const corners = [
        mapPointThroughLandscapeRotation(rect.left, rect.top, preW, preH, rotationNeeded),
        mapPointThroughLandscapeRotation(rect.right, rect.top, preW, preH, rotationNeeded),
        mapPointThroughLandscapeRotation(rect.left, rect.bottom, preW, preH, rotationNeeded),
        mapPointThroughLandscapeRotation(rect.right, rect.bottom, preW, preH, rotationNeeded),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    return {
        left: Math.min(...xs),
        top: Math.min(...ys),
        right: Math.max(...xs),
        bottom: Math.max(...ys),
    };
}

/**
 * Parse Ghostscript txtwrite TextFormat=1 HTML: span bbox + chars.
 * Coordinates are top-left origin in PDF points (72 dpi page space).
 */
export function parseGhostscriptHtmlTextSpans(html: string): TextSpanBBox[] {
    const spans: TextSpanBBox[] = [];
    const spanRe = /<span\s+bbox="([^"]+)"([^>]*)>([\s\S]*?)<\/span>/gi;
    let match: RegExpExecArray | null;
    while ((match = spanRe.exec(html)) !== null) {
        const bboxParts = match[1].trim().split(/\s+/).map(Number);
        if (bboxParts.length < 4 || bboxParts.some((n) => Number.isNaN(n))) continue;
        const [x0, y0, x1, y1] = bboxParts;
        const sizeMatch = /\bsize="([^"]+)"/i.exec(match[2]);
        const size = sizeMatch && !Number.isNaN(Number(sizeMatch[1]))
            ? Number(sizeMatch[1])
            : Math.max(1, Math.abs(y1 - y0) || 8);
        const chars = [...match[3].matchAll(/\bc="([^"]*)"/g)].map((m) => m[1]);
        const text = chars.join('').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        const left = Math.min(x0, x1);
        const right = Math.max(x0, x1);
        // y0≈y1 is baseline; expand using font size
        const baseline = Math.min(y0, y1);
        const top = Math.max(0, baseline - size);
        const bottom = baseline + size * 0.25;

        spans.push({ left, top, right, bottom, text });
    }
    return spans;
}

/**
 * Batch-extract positioned text spans (GS TextFormat=1 HTML with bboxes).
 */
export function batchExtractTextSpansWithGhostscript(
    inputPath: string,
    firstPage: number,
    lastPage: number,
    outputDir: string,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Map<number, TextSpanBBox[]> {
    return timer.timeSync('batchExtractTextSpansWithGhostscript', () => {
        const logger = getLogger('batch_extract_text_spans_ghostscript', parentLogger);
        logger.start(`Batch extracting bbox text from pages ${firstPage}-${lastPage} (GS TextFormat=1)...`);

        const outputPattern = path.join(outputDir, `_gs_bbox_%d.html`);
        const result = new Map<number, TextSpanBBox[]>();

        try {
            const flags = [
                '-dNOPAUSE',
                '-dBATCH',
                '-dSAFER',
                '-q',
                '-sDEVICE=txtwrite',
                '-dTextFormat=1',
                `-dFirstPage=${firstPage}`,
                `-dLastPage=${lastPage}`,
                `-sOutputFile=${outputPattern}`,
                inputPath,
            ];
            execFileSync('gs', flags, { stdio: 'ignore' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`Batch GS bbox txtwrite failed: ${msg}`);
            return result;
        }

        let iteration = 1;
        for (let page = firstPage; page <= lastPage; page++) {
            const filePath = path.join(outputDir, `_gs_bbox_${iteration}.html`);
            if (fs.existsSync(filePath)) {
                try {
                    const raw = fs.readFileSync(filePath, 'utf-8');
                    fs.unlinkSync(filePath);
                    result.set(page, parseGhostscriptHtmlTextSpans(raw));
                } catch {
                    result.set(page, []);
                }
            } else {
                result.set(page, []);
            }
            iteration++;
        }

        logger.finish(`Batch GS bbox extract complete for ${result.size} pages.`);
        return result;
    });
}

export type PageRectFilterContext = {
    /** Detection-space image size (after landscape correction). */
    imageWidth: number;
    imageHeight: number;
    /** Degrees applied to GS PNG to reach landscape (0/90/180/270). */
    rotationNeeded: number;
    /** Rectangles in detection-space pixels (same space as line detection). */
    excludeRectangles: Rectangle[];
};

/**
 * Convert GS PDF-point spans into detection image space and drop spans overlapping exclude rects.
 */
export function filterTextSpansOutsideRectangles(
    spans: TextSpanBBox[],
    ctx: PageRectFilterContext,
    dpi: number = config.BATCH_PDF_PAGES_DPI
): string {
    if (spans.length === 0) return '';

    const scale = dpi / 72;
    const rot = ((ctx.rotationNeeded % 360) + 360) % 360;
    const preW = rot === 90 || rot === 270 ? ctx.imageHeight : ctx.imageWidth;
    const preH = rot === 90 || rot === 270 ? ctx.imageWidth : ctx.imageHeight;

    const kept: TextSpanBBox[] = [];
    for (const span of spans) {
        const inPreRotate = {
            left: span.left * scale,
            top: span.top * scale,
            right: span.right * scale,
            bottom: span.bottom * scale,
        };
        const inDetection = mapRectThroughLandscapeRotation(inPreRotate, preW, preH, ctx.rotationNeeded);

        const hitsExclude = ctx.excludeRectangles.some((r) =>
            overlaps(inDetection, { left: r.left, top: r.top, right: r.right, bottom: r.bottom })
        );
        if (!hitsExclude) {
            kept.push({
                ...span,
                left: inDetection.left,
                top: inDetection.top,
                right: inDetection.right,
                bottom: inDetection.bottom,
            });
        }
    }

    kept.sort((a, b) => (a.top - b.top) || (a.left - b.left));

    const lines: string[] = [];
    let currentLine = '';
    let lastTop = Number.NEGATIVE_INFINITY;
    const lineGapPx = Math.max(8, dpi / 10);
    for (const span of kept) {
        if (currentLine && Math.abs(span.top - lastTop) > lineGapPx) {
            lines.push(currentLine.trim());
            currentLine = span.text;
        } else {
            currentLine = currentLine ? `${currentLine} ${span.text}` : span.text;
        }
        lastTop = span.top;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    return lines.join('\n').trim();
}
