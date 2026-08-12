import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from '../config';
import type {Rectangle, TextExtractionMethod} from '../types';

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

function spanArea(s: { left: number; top: number; right: number; bottom: number }): number {
    return Math.max(0, s.right - s.left) * Math.max(0, s.bottom - s.top);
}

function overlapArea(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number }
): number {
    const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return w * h;
}

export function decodePdfTextEntities(text: string): string {
    return text
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

/**
 * Collapse adjacent duplicate phrases ("LABEL : LABEL : 12 m2 12 m2" → "LABEL : 12 m2").
 * Vector PDFs often paint the same string many times (fill+stroke / fake bold).
 */
export function collapseRepeatedPhrases(line: string): string {
    let current = line.replace(/\s+/g, ' ').trim();
    if (!current) return '';
    let previous = '';
    while (current !== previous) {
        previous = current;
        // Must start on a token boundary so the "E" in SIPERFAQE is not
        // collapsed with the following Albanian "E" in "SIPERFAQE E PERBASHKET".
        current = current.replace(/(^|\s)(\S+(?:\s+\S+){0,12}?)\s+\2(?=\s|$)/g, '$1$2');
    }
    return current;
}

/**
 * Drop stacked copies of the same string (same text + overlapping bbox).
 */
export function dedupeOverlappingTextSpans(spans: TextSpanBBox[], minOverlapRatio = 0.45): TextSpanBBox[] {
    const sorted = [...spans].sort((a, b) => (a.top - b.top) || (a.left - b.left));
    const kept: TextSpanBBox[] = [];
    for (const span of sorted) {
        const key = span.text.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!key) continue;
        const duplicate = kept.some((other) => {
            if (other.text.replace(/\s+/g, ' ').trim().toLowerCase() !== key) return false;
            const smaller = Math.min(spanArea(span), spanArea(other));
            if (smaller <= 0) {
                return Math.abs(span.top - other.top) < 2 && Math.abs(span.left - other.left) < 2;
            }
            return overlapArea(span, other) / smaller >= minOverlapRatio;
        });
        if (!duplicate) kept.push(span);
    }
    return kept;
}

export function formatTextSpansAsPageText(spans: TextSpanBBox[], lineGapPx = 8): string {
    const unique = dedupeOverlappingTextSpans(spans);
    const sorted = [...unique].sort((a, b) => (a.top - b.top) || (a.left - b.left));
    const rows: TextSpanBBox[][] = [];
    let currentRow: TextSpanBBox[] = [];
    let lastTop = Number.NEGATIVE_INFINITY;
    for (const span of sorted) {
        if (currentRow.length && Math.abs(span.top - lastTop) > lineGapPx) {
            rows.push(currentRow);
            currentRow = [span];
        } else {
            currentRow.push(span);
        }
        lastTop = span.top;
    }
    if (currentRow.length) rows.push(currentRow);

    // Reading order within a row is horizontal. The outer sort is top-first, so
    // word-level spans whose glyph boxes start a fraction of a point apart
    // vertically (a digit next to a capital, say) would otherwise be emitted
    // back-to-front — "0 KATIT E PLANIMETRI" instead of "PLANIMETRI E KATIT 0".
    const lines = rows.map((row) =>
        collapseRepeatedPhrases([...row].sort((a, b) => a.left - b.left).map((s) => s.text).join(' '))
    );
    return lines.filter(Boolean).join('\n').trim();
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
        const chars = [...match[3].matchAll(/\bc="([^"]*)"/g)].map((m) => decodePdfTextEntities(m[1]));
        const text = decodePdfTextEntities(chars.join('').replace(/\s+/g, ' ').trim());
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

/**
 * Parse poppler `pdftotext -bbox-layout` XHTML into per-page word spans.
 *
 * `<word>` boxes are already top-left origin in PDF points (72 dpi) and in the
 * rotated display space, i.e. the same convention `parseGhostscriptHtmlTextSpans`
 * produces, so the spans drop straight into the rest of the pipeline. Unlike
 * Ghostscript these are true glyph boxes, so no font-size guesswork is needed.
 *
 * @param xml        Full pdftotext output document
 * @param firstPage  1-based page number the first `<page>` element corresponds to
 */
export function parsePopplerBboxLayoutXml(xml: string, firstPage: number): Map<number, TextSpanBBox[]> {
    const result = new Map<number, TextSpanBBox[]>();
    const pageRe = /<page\b[^>]*>([\s\S]*?)<\/page>/gi;
    const wordRe = /<word\b([^>]*)>([\s\S]*?)<\/word>/gi;
    const readAttr = (attrs: string, name: string): number => {
        const match = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(attrs);
        return match ? Number(match[1]) : NaN;
    };

    let pageMatch: RegExpExecArray | null;
    let pageNumber = firstPage;
    while ((pageMatch = pageRe.exec(xml)) !== null) {
        const spans: TextSpanBBox[] = [];
        wordRe.lastIndex = 0;
        let wordMatch: RegExpExecArray | null;
        while ((wordMatch = wordRe.exec(pageMatch[1])) !== null) {
            const x0 = readAttr(wordMatch[1], 'xMin');
            const y0 = readAttr(wordMatch[1], 'yMin');
            const x1 = readAttr(wordMatch[1], 'xMax');
            const y1 = readAttr(wordMatch[1], 'yMax');
            if ([x0, y0, x1, y1].some((n) => Number.isNaN(n))) continue;
            const text = decodePdfTextEntities(wordMatch[2].replace(/\s+/g, ' ').trim());
            if (!text) continue;
            spans.push({
                left: Math.min(x0, x1),
                top: Math.min(y0, y1),
                right: Math.max(x0, x1),
                bottom: Math.max(y0, y1),
                text,
            });
        }
        result.set(pageNumber, spans);
        pageNumber++;
    }
    return result;
}

/**
 * Batch-extract positioned text spans with poppler (`pdftotext -bbox-layout`).
 *
 * Preferred over the Ghostscript path because `txtwrite` intermittently drops
 * whole text runs: across 12 identical 62-page runs of Dyeus_Album, 4 lost the
 * "APARTAMENTI <id> KATI <n>" title on at least one page — a different page set
 * each time — which silently cost those units their name. poppler is
 * byte-identical run to run and several times faster.
 *
 * @returns spans per page, or null when pdftotext is unavailable / failed, so
 *          the caller can fall back to Ghostscript.
 */
export function batchExtractTextSpansWithPoppler(
    inputPath: string,
    firstPage: number,
    lastPage: number,
    outputDir: string,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Map<number, TextSpanBBox[]> | null {
    return timer.timeSync('batchExtractTextSpansWithPoppler', () => {
        const logger = getLogger('batch_extract_text_spans_poppler', parentLogger);
        logger.start(`Batch extracting bbox text from pages ${firstPage}-${lastPage} (pdftotext -bbox-layout)...`);

        const outputPath = path.join(outputDir, `_poppler_bbox.xml`);
        try {
            execFileSync(
                'pdftotext',
                ['-q', '-bbox-layout', '-f', String(firstPage), '-l', String(lastPage), inputPath, outputPath],
                { stdio: 'ignore' }
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`pdftotext bbox extraction unavailable or failed (${msg}); falling back to Ghostscript.`);
            return null;
        }

        try {
            const raw = fs.readFileSync(outputPath, 'utf-8');
            fs.unlinkSync(outputPath);
            const result = parsePopplerBboxLayoutXml(raw, firstPage);
            for (let page = firstPage; page <= lastPage; page++) {
                if (!result.has(page)) result.set(page, []);
            }
            logger.finish(`Poppler bbox extract complete for ${result.size} pages.`);
            return result;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`Reading pdftotext output failed: ${msg}; falling back to Ghostscript.`);
            return null;
        }
    });
}

/**
 * Positioned text spans for a page range, preferring poppler and falling back
 * to Ghostscript when `pdftotext` is not installed.
 */
export function batchExtractTextSpans(
    inputPath: string,
    firstPage: number,
    lastPage: number,
    outputDir: string,
    parentLogger: serverLogger,
    timer: PerformanceTimer
): { spans: Map<number, TextSpanBBox[]>; extractionMethod: TextExtractionMethod } {
    const viaPoppler = batchExtractTextSpansWithPoppler(inputPath, firstPage, lastPage, outputDir, parentLogger, timer);
    if (viaPoppler) {
        return { spans: viaPoppler, extractionMethod: 'poppler' };
    }
    return {
        spans: batchExtractTextSpansWithGhostscript(inputPath, firstPage, lastPage, outputDir, parentLogger, timer),
        extractionMethod: 'ghostscript',
    };
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

function mapSpansToDetectionSpace(
    spans: TextSpanBBox[],
    ctx: Pick<PageRectFilterContext, 'imageWidth' | 'imageHeight' | 'rotationNeeded'>,
    dpi: number = config.BATCH_PDF_PAGES_DPI
): TextSpanBBox[] {
    if (spans.length === 0) return [];

    const scale = dpi / 72;
    const rot = ((ctx.rotationNeeded % 360) + 360) % 360;
    const preW = rot === 90 || rot === 270 ? ctx.imageHeight : ctx.imageWidth;
    const preH = rot === 90 || rot === 270 ? ctx.imageWidth : ctx.imageHeight;

    return spans.map((span) => {
        const inPreRotate = {
            left: span.left * scale,
            top: span.top * scale,
            right: span.right * scale,
            bottom: span.bottom * scale,
        };
        const inDetection = mapRectThroughLandscapeRotation(inPreRotate, preW, preH, ctx.rotationNeeded);
        return {
            ...span,
            left: inDetection.left,
            top: inDetection.top,
            right: inDetection.right,
            bottom: inDetection.bottom,
        };
    });
}

/**
 * Convert GS PDF-point spans into detection image space and drop spans overlapping exclude rects.
 */
export function filterTextSpansOutsideRectangles(
    spans: TextSpanBBox[],
    ctx: PageRectFilterContext,
    dpi: number = config.BATCH_PDF_PAGES_DPI
): string {
    if (spans.length === 0) return '';

    const detectionSpans = mapSpansToDetectionSpace(spans, ctx, dpi);
    const kept = detectionSpans.filter((inDetection) =>
        !ctx.excludeRectangles.some((r) =>
            overlaps(inDetection, { left: r.left, top: r.top, right: r.right, bottom: r.bottom })
        )
    );

    const lineGapPx = Math.max(8, dpi / 10);
    return formatTextSpansAsPageText(kept, lineGapPx);
}