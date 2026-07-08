import fs from 'fs';
import sharp from 'sharp';
import {getLogger, serverLogger} from '@coreModule/loggers/serverLog';
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import type {PolygonPoint} from './types';

// ---------------- Configuration ----------------

/**
 * Configuration for highlight detection on a floor plan image.
 *
 * The detector operates in HSV space and isolates pixels that are sufficiently
 * "colored" (i.e. saturated and not too dark/light). Because a typical
 * architectural floor plan is mostly greyscale linework, hatching, and
 * dimension text, ANY sufficiently saturated region is — by elimination —
 * a coloured highlight (a red unit fill, a teal/cyan unit fill, etc.).
 *
 * Two operating modes:
 *
 * 1. Color-agnostic (DEFAULT): leave `hueRanges` undefined. The detector
 *    accepts any hue, only requiring `saturationMin <= S` and
 *    `valueMin <= V <= valueMax`. This is the most robust default and
 *    handles red highlights (existing case) AND non-red highlights
 *    (cyan/teal/blue/etc.) with a single mask.
 *
 * 2. Hue-restricted: pass one or more `[hueMin, hueMax]` pairs (OpenCV
 *    hue range is 0-180). Multiple ranges are OR'd together — useful for
 *    hues that wrap around 0/180 (red is [[0,10],[170,180]]). Use this
 *    when the document conventions guarantee a specific colour and you
 *    want to reject incidental coloured elements (logos, north arrows).
 */
export interface HighlightColorConfig {
    /**
     * Optional list of hue ranges (each `[min, max]` in OpenCV's 0-180
     * scale). When omitted or empty the detector is fully color-agnostic.
     * Multiple ranges are combined with OR (handles wrap-around hues like red).
     */
    hueRanges?: Array<[number, number]>;
    /** Minimum saturation (0-255). Pixels below this are treated as desaturated. */
    saturationMin: number;
    /** Minimum value/brightness (0-255). Excludes very dark pixels (e.g. black ink). */
    valueMin: number;
    /** Maximum value/brightness (0-255). Excludes near-white background. Default 255. */
    valueMax: number;
    /**
     * Pre-threshold Gaussian blur radius, expressed as a fraction of
     * min(width, height). Smooths the high-frequency noise produced by
     * architectural linework underneath semi-transparent highlight fills.
     * 0 disables blur. Default 0.0035.
     */
    blurFraction: number;
    /**
     * Morphological CLOSE kernel size, expressed as a fraction of
     * min(width, height). Must be large enough to bridge gaps caused by
     * black walls puncturing through the colour fill — typical wall
     * thicknesses on a 2000 px render are ~10-20 px, so the default
     * (~1 %) covers them comfortably. Default 0.012.
     */
    closeKernelFraction: number;
    /**
     * Morphological OPEN kernel size, expressed as a fraction of
     * min(width, height). Kept small — the noise floor on contour area
     * already filters incidental coloured specks, so OPEN's only job
     * here is to delete single-pixel noise. Default 0.002.
     */
    openKernelFraction: number;
    /**
     * Final outward dilation, as a fraction of min(width, height).
     * Compensates for the inward bias of strict-threshold masking:
     * anti-aliased fill edges have decaying saturation and fall just
     * inside the visible boundary; this small expansion pushes the
     * polygon back out to the user-visible edge. Default 0.0025.
     */
    finalDilateFraction: number;
    /**
     * Douglas-Peucker simplification epsilon as a fraction of contour
     * perimeter. OpenCV's documentation suggests 0.02 for "rough"
     * simplification; we use 0.008 to preserve genuine corners on
     * irregular (e.g. L- or U-shaped) unit highlights. Default 0.008.
     */
    approxPolyEpsilonFraction: number;
}

/**
 * Color-agnostic default. Picks up any prominent saturated fill region on a
 * mostly-greyscale floor plan. Tuned conservatively so anti-aliased edges of
 * black ink on white do NOT pollute the mask.
 */
export const DEFAULT_HIGHLIGHT_CONFIG: HighlightColorConfig = {
    saturationMin: 60,
    valueMin: 50,
    valueMax: 255,
    blurFraction: 0.0035,
    closeKernelFraction: 0.012,
    openKernelFraction: 0.002,
    finalDilateFraction: 0.0025,
    approxPolyEpsilonFraction: 0.008,
    // hueRanges omitted → accept any hue
};

// ---------------- Multi-polygon QA overlay (sharp + SVG) ----------------

const POLYGON_OVERLAY_PALETTE = [
    '#22c55e',
    '#f97316',
    '#06b6d4',
    '#e11d48',
    '#a855f7',
    '#ca8a04',
    '#3b82f6',
    '#ec4899'
];

/**
 * Multiple polygons in pixel coordinates; `colors` and `regionLabels` align with `pixelPolygons` order.
 * Draw smallest-area regions last so compact units remain visible on top of large shells.
 */
function buildMultiPolygonOverlaySvg(
    width: number,
    height: number,
    pixelPolygons: PolygonPoint[][],
    colors: string[],
    regionLabels: number[],
    strokeWidth: number = 3
): string {
    const parts: string[] = [];
    for (let pi = 0; pi < pixelPolygons.length; pi++) {
        const polygon = pixelPolygons[pi];
        if (polygon.length === 0) continue;
        const strokeColor = colors[pi] ?? POLYGON_OVERLAY_PALETTE[pi % POLYGON_OVERLAY_PALETTE.length];
        const rn = regionLabels[pi] ?? pi + 1;
        const lines: string[] = [];
        const labels: string[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const curr = polygon[i];
            const next = polygon[(i + 1) % polygon.length];
            lines.push(
                `<line x1="${curr.x}" y1="${curr.y}" x2="${next.x}" y2="${next.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`
            );
            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;
            labels.push(
                `<text x="${midX}" y="${midY}" fill="white" font-size="11" font-weight="bold" text-anchor="middle" dominant-baseline="middle" stroke="black" stroke-width="2" stroke-linejoin="round" paint-order="stroke">${rn}.${i + 1}</text>`
            );
        }
        const verts = polygon
            .map(
                (p) =>
                    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${strokeColor}" stroke="white" stroke-width="1" />`
            )
            .join('');
        parts.push(`<g>${lines.join('')}${verts}${labels.join('')}</g>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`;
}

/**
 * Overlays multiple polygon rings (fractional coordinates) with distinct colors; smallest regions draw on top.
 */
export async function overlayPolygonsOnImage(
    imagePath: string,
    outputPath: string,
    polygonsFractional: PolygonPoint[][],
    areasPxSq: number[],
    parentLogger: serverLogger,
    timer: PerformanceTimer
): Promise<void> {
    return await timer.timeAsync('overlayPolygonsOnImage', async () => {
        const logger = getLogger('overlay_polygons_on_image', parentLogger);
        logger.start(
            `Overlaying ${polygonsFractional.length} polygon(s) on ${imagePath} -> ${outputPath}`
        );

        if (!fs.existsSync(imagePath)) {
            logger.warn(`Image file not found: ${imagePath}`);
            return;
        }
        if (polygonsFractional.length === 0) {
            logger.warn('No polygons to overlay');
            return;
        }

        const n = polygonsFractional.length;
        const areas =
            areasPxSq.length === n
                ? areasPxSq
                : polygonsFractional.map((_, i) => areasPxSq[i] ?? (n - i));

        try {
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            const width = metadata.width || 0;
            const height = metadata.height || 0;

            if (width === 0 || height === 0) {
                logger.warn(`Invalid image dimensions: ${width}x${height}`);
                return;
            }

            const order = areas.map((a, i) => ({a, i})).sort((x, y) => x.a - y.a);
            const drawIdx = order.map(({i}) => i);

            const pixelPolys = drawIdx.map((idx) =>
                polygonsFractional[idx].map((p) => ({
                    x: p.x * width,
                    y: p.y * height
                }))
            );
            const colors = drawIdx.map((idx) => POLYGON_OVERLAY_PALETTE[idx % POLYGON_OVERLAY_PALETTE.length]);
            const regionLabels = drawIdx.map((idx) => idx + 1);

            logger.debug(
                `Overlay: ${pixelPolys.length} region(s), draw order by ascending area (smallest on top)`
            );

            const svgOverlay = buildMultiPolygonOverlaySvg(
                width,
                height,
                pixelPolys,
                colors,
                regionLabels
            );

            await image
                .composite([{input: Buffer.from(svgOverlay), blend: 'over'}])
                .png()
                .toFile(outputPath);

            logger.finish(`Successfully saved multi-polygon overlay to ${outputPath}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`Error overlaying polygons: ${message}`);
            throw error;
        }
    });
}
