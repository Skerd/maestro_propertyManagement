import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type {Mat} from '@u4/opencv4nodejs';
import {getLogger, serverLogger} from '@coreModule/loggers/serverLog';
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import type {PolygonPoint} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types';
import {
    DEFAULT_HIGHLIGHT_CONFIG,
    type HighlightColorConfig
} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/polygonExtraction';
import {config} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/config';
import {ensureDir} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/fileUtils";

/** Cap how many HSV mask regions are drawn on the multi-polygon overlay (not configurable). */
const HIGHLIGHT_OVERLAY_MAX_REGIONS = 24;

type CvModule = (typeof import('@u4/opencv4nodejs'))['default'];

function saveHighlightDebugMat(cv: CvModule, debugDir: string | undefined, fileName: string, mat: Mat): void {
    if (!debugDir) return;
    fs.mkdirSync(debugDir, {recursive: true});
    cv.imwrite(path.join(debugDir, fileName), mat);
}

function loadCv(): CvModule | null {
    try {
        // Native module may be unavailable in some environments.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@u4/opencv4nodejs') as typeof import('@u4/opencv4nodejs');
        return mod.default;
    } catch {
        return null;
    }
}

function safeRelease(...mats: Array<Mat | null | undefined>) {
    for (const m of mats) {
        m?.release();
    }
}

/**
 * Thickness compensation (09): repeated 3×3 dilate of the 08 mask only — no prior mask, no clip.
 * `seed` is consumed.
 */
function dilateMaskOnly(cv: CvModule, seed: Mat, iterations: number): Mat {
    const k3 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    let cur: Mat = seed;
    const cap = Math.max(1, iterations);
    for (let i = 0; i < cap; i++) {
        const dil = cur.dilate(k3, new cv.Point2(-1, -1));
        const prev = cur;
        cur = dil;
        prev.release();
    }
    k3.release();
    return cur;
}

function adaptiveOddKernel(fraction: number, refDim: number, min: number = 3, max: number = 101): number {
    if (fraction <= 0 || refDim <= 0) return 0;
    let k = Math.round(fraction * refDim);
    if (k % 2 === 0) k += 1;
    return Math.max(min, Math.min(max, k));
}

function calculateSignedArea(points: PolygonPoint[]): number {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2;
}

function ensureConsistentOrdering(points: PolygonPoint[], forceClockwise: boolean): PolygonPoint[] {
    if (points.length < 3) return points;
    const signedArea = calculateSignedArea(points);
    const isClockwise = signedArea < 0;
    if ((forceClockwise && !isClockwise) || (!forceClockwise && isClockwise)) {
        return [...points].reverse();
    }
    return points;
}

function toRelativePolygonPoints(points: PolygonPoint[], width: number, height: number): PolygonPoint[] {
    if (width <= 0 || height <= 0) return points;
    return points.map((p) => ({
        x: p.x / width,
        y: p.y / height
    }));
}

/**
 * HSV inRange masks merged with OR (full hue or multiple hue windows).
 */
function buildHighlightMaskHsv(hsv: Mat, config: HighlightColorConfig, cv: CvModule): Mat {
    const valueMax = config.valueMax;
    const ranges: Array<[number, number]> =
        config.hueRanges && config.hueRanges.length > 0 ? config.hueRanges : [[0, 180]];

    let mask: Mat | null = null;
    for (const [hueMin, hueMax] of ranges) {
        const partial = hsv.inRange(
            new cv.Vec3(hueMin, config.saturationMin, config.valueMin),
            new cv.Vec3(hueMax, 255, valueMax)
        );
        if (!mask) {
            mask = partial;
        } else {
            const merged: Mat = mask.bitwiseOr(partial);
            safeRelease(mask, partial);
            mask = merged;
        }
    }
    return mask!;
}

/** Homography that maps a unit thumbnail's pixel space → master floor plan pixel space. */
export type ThumbMasterRegistration = {H: number[]; masterW: number; masterH: number};

export type HighlightExtractionOpencv4Result = {
    /** Chosen unit outline (fractional coords), when plausibility selection succeeds. */
    unitPolygon: PolygonPoint[] | undefined;
    /** All mask regions above noise (largest first), for multi-color overlay; areas match indices. */
    allPolygons: PolygonPoint[][];
    allPolygonAreas: number[];
    /**
     * true when unitPolygon coords are relative to the master floor plan
     * (fresh registration, floor-cached registration, or simple scale fallback).
     * false when they are relative to the unit thumbnail only (no master available).
     */
    registeredToMaster: boolean;
    /** How the polygon was placed onto the master (or `none` if thumbnail-space only). */
    registrationSource?: 'fresh' | 'floor-fallback' | 'scale-fallback' | 'none';
    /**
     * Freshly computed registration for this unit's thumbnail, when registration succeeded from scratch.
     * Cache this at floor level and pass as `fallbackRegistration` for other units on the same floor
     * that may fail to register independently.
     */
    computedRegistration?: ThumbMasterRegistration;
};

type HighlightContourWork = {
    area: number;
    arcLength: (closed: boolean) => number;
    approxPolyDP: (epsilon: number, closed: boolean) => {x: number; y: number}[];
};

function contourToFractionalPolygon(contour: HighlightContourWork, w: number, h: number, cfg: HighlightColorConfig): PolygonPoint[] {
    const arcLen = contour.arcLength(true);
    const epsilon = cfg.approxPolyEpsilonFraction * arcLen;
    const pts = contour.approxPolyDP(epsilon, true);
    if (pts.length < 3) {
        return [];
    }
    const points: PolygonPoint[] = pts.map((p) => ({x: p.x, y: p.y}));
    const ordered = ensureConsistentOrdering(points, true);
    return toRelativePolygonPoints(ordered, w, h);
}

function buildAllOverlayPolygons(contours: HighlightContourWork[], w: number, h: number, cfg: HighlightColorConfig, maxRegions: number): {polygons: PolygonPoint[][]; areas: number[]} {
    const polygons: PolygonPoint[][] = [];
    const areas: number[] = [];
    for (const c of contours.slice(0, maxRegions)) {
        const rel = contourToFractionalPolygon(c, w, h, cfg);
        if (rel.length >= 3) {
            polygons.push(rel);
            areas.push(c.area);
        }
    }
    return {polygons, areas};
}

/** Flat row-major 3×3 homography coefficients: [h00,h01,h02, h10,h11,h12, h20,h21,h22] */
function applyHomography(H: number[], px: number, py: number): {x: number; y: number} | null {
    const denom = H[6] * px + H[7] * py + H[8];
    if (Math.abs(denom) < 1e-9) return null;
    return {x: (H[0] * px + H[1] * py + H[2]) / denom, y: (H[3] * px + H[4] * py + H[5]) / denom};
}

/**
 * Maps thumbnail polygon to master space while preserving its shape.
 *
 * A full projective homography (8 DOF) can distort shapes — a rectangle
 * on the thumbnail could become a trapezoid on the master. For flat document
 * scans the real transform is similarity (scale + rotation + translation),
 * so perspective distortion is pure registration noise.
 *
 * Fix: map the polygon centroid through the full H (correct location),
 * then apply H's Jacobian (its linear/affine approximation at that point)
 * to each vertex offset from the centroid. This gives correct position +
 * correct scale/rotation, with the projective component stripped out so
 * the shape is preserved exactly.
 */
function remapFractionalPolygon(
    pts: PolygonPoint[],
    thumbW: number,
    thumbH: number,
    H: number[],
    masterW: number,
    masterH: number,
): PolygonPoint[] | null {
    // Centroid of the thumbnail polygon in pixel space
    const tcx = pts.reduce((s, p) => s + p.x * thumbW, 0) / pts.length;
    const tcy = pts.reduce((s, p) => s + p.y * thumbH, 0) / pts.length;

    // Map centroid through the full homography to get the correct master position
    const mc = applyHomography(H, tcx, tcy);
    if (!mc) return null;

    // Jacobian of H at (tcx, tcy): the affine linearisation at the centroid.
    // Removes projective distortion; for flat docs this is equivalent to the
    // true similarity transform (scale + rotation only at this point).
    const w = H[6] * tcx + H[7] * tcy + H[8];
    const J00 = (H[0] - H[6] * mc.x) / w;
    const J01 = (H[1] - H[7] * mc.x) / w;
    const J10 = (H[3] - H[6] * mc.y) / w;
    const J11 = (H[4] - H[7] * mc.y) / w;

    const out: PolygonPoint[] = [];
    for (const p of pts) {
        const dx = p.x * thumbW - tcx;
        const dy = p.y * thumbH - tcy;
        const mx = mc.x + J00 * dx + J01 * dy;
        const my = mc.y + J10 * dx + J11 * dy;
        out.push({x: Math.max(0, Math.min(1, mx / masterW)), y: Math.max(0, Math.min(1, my / masterH))});
    }
    return out;
}

/**
 * When area-based registration fails, map the highlight polygon onto the master
 * floor plan by anisotropic scale (thumbnail frame → master frame).
 *
 * After {@link config.UNIT_FLOOR_PLAN_MATCH_MASTER_ASPECT} letterboxing, thumb and
 * master share aspect ratio so this is effectively uniform scale; fractional
 * coords transfer 1:1. Without letterboxing it still yields master-normalized
 * coordinates suitable for floor-plan overlays.
 */
function scaleThumbnailPolygonToMaster(
    pts: PolygonPoint[],
    thumbW: number,
    thumbH: number,
    masterW: number,
    masterH: number,
): PolygonPoint[] {
    if (thumbW <= 0 || thumbH <= 0 || masterW <= 0 || masterH <= 0) {
        return pts.map((p) => ({x: p.x, y: p.y}));
    }
    const sx = masterW / thumbW;
    const sy = masterH / thumbH;
    return pts.map((p) => {
        const mx = p.x * thumbW * sx;
        const my = p.y * thumbH * sy;
        return {
            x: Math.max(0, Math.min(1, mx / masterW)),
            y: Math.max(0, Math.min(1, my / masterH)),
        };
    });
}

async function readImageSize(imagePath: string): Promise<{width: number; height: number} | null> {
    try {
        const meta = await sharp(imagePath).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (width <= 0 || height <= 0) return null;
        return {width, height};
    } catch {
        return null;
    }
}

type ThumbToMasterReg = {H: number[]; masterW: number; masterH: number} | null;

const DEBUG_OVERLAY_COLORS = ['#22c55e', '#f97316', '#06b6d4', '#e11d48', '#a855f7'];

async function savePolygonDebugOverlay(
    imagePath: string,
    polygons: PolygonPoint[][],
    outputPath: string,
    logger: serverLogger,
): Promise<void> {
    try {
        const image = sharp(imagePath);
        const meta = await image.metadata();
        const iw = meta.width ?? 0;
        const ih = meta.height ?? 0;
        if (iw === 0 || ih === 0) return;

        const parts: string[] = [];
        for (let i = 0; i < polygons.length; i++) {
            const color = DEBUG_OVERLAY_COLORS[i % DEBUG_OVERLAY_COLORS.length];
            const pixelPts = polygons[i].map(p => ({x: p.x * iw, y: p.y * ih}));
            const pointsAttr = pixelPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            parts.push(`<polygon points="${pointsAttr}" fill="${color}33" stroke="${color}" stroke-width="3" stroke-linejoin="round" />`);
            for (let vi = 0; vi < pixelPts.length; vi++) {
                const p = pixelPts[vi];
                parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${color}" stroke="white" stroke-width="2" />`);
                parts.push(`<text x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" fill="white" font-size="13" font-weight="bold" text-anchor="middle" stroke="black" stroke-width="2" paint-order="stroke">${vi + 1}</text>`);
            }
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}">${parts.join('')}</svg>`;
        await image.composite([{input: Buffer.from(svg), blend: 'over'}]).png().toFile(outputPath);
    } catch (err) {
        logger.warn(`savePolygonDebugOverlay failed for ${outputPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/**
 * Convert a greyscale floor plan to a crisp binary ink map (white lines on black).
 * Adaptive threshold restores sharp strokes after downscale (avoids soft grey anti-alias mush),
 * then a short close+dilate unifies stroke weight on both thumb and master.
 */
function toStructuralInk(cv: CvModule, gray: Mat): Mat {
    const ref = Math.min(gray.cols, gray.rows);
    const block = adaptiveOddKernel(0.035, ref, 11, 51);
    // Dark CAD ink → white
    const binary = gray.adaptiveThreshold(
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        block,
        10
    );
    const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    const closed = binary.morphologyEx(k, cv.MORPH_CLOSE, new cv.Point2(-1, -1));
    safeRelease(binary);
    const thick = closed.dilate(k, new cv.Point2(-1, -1));
    safeRelease(closed, k);
    return thick;
}

/**
 * Blank circular CAD grid bubbles near the image border (annotation rings), so they
 * do not dominate matching. Interior circles (furniture, etc.) are left alone.
 * Mutates `ink` in place when bubbles are found.
 */
function suppressGridBubbles(cv: CvModule, ink: Mat): number {
    if (!config.REGISTRATION_SUPPRESS_GRID_BUBBLES) return 0;
    const w = ink.cols;
    const h = ink.rows;
    const ref = Math.min(w, h);
    const minR = Math.max(4, Math.round(ref * 0.008));
    const maxR = Math.max(minR + 2, Math.round(ref * 0.028));
    const margin = Math.round(ref * 0.14);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circles: any[] = ink.houghCircles(
        cv.HOUGH_GRADIENT,
        1.2,
        Math.max(16, Math.round(ref * 0.05)),
        100,
        28,
        minR,
        maxR
    );
    if (!circles || circles.length === 0) return 0;
    let n = 0;
    for (const c of circles) {
        const x = Math.round(c.x);
        const y = Math.round(c.y);
        const onBorder = x < margin || y < margin || x > w - margin || y > h - margin;
        if (!onBorder) continue;
        const r = Math.round(c.z) + 2;
        ink.drawCircle(new cv.Point2(x, y), r, new cv.Vec3(0, 0, 0), -1);
        n++;
    }
    return n;
}

/** Axis-aligned bbox of non-zero ink pixels, or null if empty. */
function inkContentBBox(ink: Mat): {x: number; y: number; w: number; h: number} | null {
    const pts = ink.findNonZero();
    if (!pts || pts.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
        const x = p.x, y = p.y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX)) return null;
    return {
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        w: Math.max(1, maxX - minX + 1),
        h: Math.max(1, maxY - minY + 1),
    };
}

/** Lift a match-space 3×3 H into full-resolution master pixel space. */
function liftMatchHomographyToFull(Hmatch: number[], scaleX: number, scaleY: number): number[] {
    return [
        Hmatch[0] * scaleX, Hmatch[1] * scaleX, Hmatch[2] * scaleX,
        Hmatch[3] * scaleY, Hmatch[4] * scaleY, Hmatch[5] * scaleY,
        0, 0, 1,
    ];
}

/**
 * Distinctive shared landmarks used for registration — grey fills, courtyard voids,
 * and general wall-enclosed polygons. Plans are similarly framed, so matches are
 * constrained to a local neighborhood (same relative page position ± tolerance).
 */
type LandmarkKind = 'grey-fill' | 'void' | 'polygon';

type Landmark = {
    kind: LandmarkKind;
    cx: number;
    cy: number;
    px: number;
    py: number;
    area: number;
    areaFrac: number;
    aspect: number;
    /** 1 = solid fill of bbox; lower = irregular / concave. */
    fill: number;
    bbox: {x: number; y: number; w: number; h: number};
    /** Approx polygon outline (for debug + matching visualization). */
    points: Array<{x: number; y: number}>;
};

function landmarkFromContour(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contour: any,
    kind: LandmarkKind,
    imgW: number,
    imgH: number,
): Landmark | null {
    const area = contour.area as number;
    const imgArea = imgW * imgH;
    const minFrac = config.REGISTRATION_LANDMARK_MIN_AREA_FRACTION;
    if (area < Math.max(64, imgArea * minFrac)) return null;
    if (area > imgArea * 0.55) return null;
    const br = contour.boundingRect();
    if (br.width < 8 || br.height < 8) return null;
    const m = contour.moments();
    if (m.m00 < 1e-6) return null;
    const px = m.m10 / m.m00;
    const py = m.m01 / m.m00;
    const aspect = br.width / Math.max(1, br.height);
    const fill = area / Math.max(1, br.width * br.height);
    // Skinny strips are grid/dimension leftovers.
    if (aspect > 5 || aspect < 1 / 5) return null;
    if (kind === 'polygon') {
        if (fill < 0.18) return null;
    } else if (fill < 0.25) {
        return null;
    }

    const peri = contour.arcLength(true);
    const eps = Math.max(1.5, 0.02 * peri);
    const approx = peri > 0 ? contour.approxPolyDP(eps, true) : [];
    let points: Array<{x: number; y: number}>;
    if (approx && approx.length >= 3) {
        points = approx.map((p: {x: number; y: number}) => ({x: p.x, y: p.y}));
    } else {
        const pts = contour.getPoints().map((p: {x: number; y: number}) => ({x: p.x, y: p.y}));
        points = pts.length >= 3
            ? pts
            : [
                {x: br.x, y: br.y},
                {x: br.x + br.width, y: br.y},
                {x: br.x + br.width, y: br.y + br.height},
                {x: br.x, y: br.y + br.height},
            ];
    }

    return {
        kind,
        cx: px / imgW,
        cy: py / imgH,
        px, py,
        area,
        areaFrac: area / imgArea,
        aspect,
        fill,
        bbox: {x: br.x, y: br.y, w: br.width, h: br.height},
        points,
    };
}

/** Contours from a binary mask → landmarks with polygon outlines. */
function landmarksFromBinaryMask(
    cv: CvModule,
    binary: Mat,
    kind: LandmarkKind,
): Landmark[] {
    const w = binary.cols, h = binary.rows;
    const work = binary.copy();
    const contours = work.findContours(cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    safeRelease(work);
    const out: Landmark[] = [];
    for (const c of contours) {
        const lm = landmarkFromContour(c, kind, w, h);
        if (lm) out.push(lm);
    }
    return out;
}

/**
 * Flat mid-tone fills (shaded landscape / grey hatches that read as solid grey after downscale).
 */
function extractGreyFillLandmarks(cv: CvModule, gray: Mat): Landmark[] {
    const w = gray.cols, h = gray.rows;
    let blur: Mat | null = null;
    let diff: Mat | null = null;
    let flat: Mat | null = null;
    let mid: Mat | null = null;
    let mask: Mat | null = null;
    let opened: Mat | null = null;
    let k: Mat | null = null;
    try {
        const ref = Math.min(w, h);
        const blurK = adaptiveOddKernel(0.02, ref, 5, 21);
        blur = gray.gaussianBlur(new cv.Size(blurK, blurK), 0);
        diff = gray.absdiff(blur);
        flat = diff.threshold(36, 255, cv.THRESH_BINARY_INV);
        mid = gray.threshold(40, 255, cv.THRESH_BINARY);
        const hi = gray.threshold(215, 255, cv.THRESH_BINARY_INV);
        const band = mid.bitwiseAnd(hi);
        safeRelease(hi);
        mask = band.bitwiseAnd(flat);
        safeRelease(band);

        const openSz = adaptiveOddKernel(0.012, ref, 3, 9);
        k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(openSz, openSz));
        const closed = mask.morphologyEx(k, cv.MORPH_CLOSE, new cv.Point2(-1, -1));
        opened = closed.morphologyEx(k, cv.MORPH_OPEN, new cv.Point2(-1, -1));
        safeRelease(closed);
        return landmarksFromBinaryMask(cv, opened, 'grey-fill');
    } finally {
        safeRelease(blur, diff, flat, mid, mask, opened, k);
    }
}

/** Large empty courtyards / rooms: white space enclosed by walls. */
function extractVoidLandmarks(cv: CvModule, ink: Mat): Landmark[] {
    const w = ink.cols, h = ink.rows;
    let inv: Mat | null = null;
    let opened: Mat | null = null;
    let k: Mat | null = null;
    try {
        const ref = Math.min(w, h);
        inv = ink.bitwiseNot();
        const openSz = adaptiveOddKernel(0.018, ref, 5, 15);
        k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(openSz, openSz));
        opened = inv.morphologyEx(k, cv.MORPH_OPEN, new cv.Point2(-1, -1));
        const all = landmarksFromBinaryMask(cv, opened, 'void');
        // Drop near-full-page leftovers that hug the border.
        return all.filter(lm => {
            if (lm.bbox.x <= 1 && lm.bbox.y <= 1 && (lm.bbox.w > w * 0.8 || lm.bbox.h > h * 0.8)) {
                return false;
            }
            return lm.fill >= 0.3;
        });
    } finally {
        safeRelease(inv, opened, k);
    }
}

/**
 * General wall-enclosed polygons (rooms / irregular shapes) from structural ink.
 * Less fill-strict than voids — captures L-shapes and non-rectangular rooms.
 */
function extractPolygonLandmarks(cv: CvModule, ink: Mat): Landmark[] {
    let inv: Mat | null = null;
    let opened: Mat | null = null;
    let k: Mat | null = null;
    try {
        const ref = Math.min(ink.cols, ink.rows);
        inv = ink.bitwiseNot();
        // Lighter open than voids — keep irregular room outlines intact.
        const openSz = adaptiveOddKernel(0.01, ref, 3, 9);
        k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(openSz, openSz));
        opened = inv.morphologyEx(k, cv.MORPH_OPEN, new cv.Point2(-1, -1));
        const all = landmarksFromBinaryMask(cv, opened, 'polygon');
        // Prefer shapes with a real polygon (≥4 verts) — not just thin rectangles.
        return all.filter(lm => lm.points.length >= 4 && lm.areaFrac >= config.REGISTRATION_LANDMARK_MIN_AREA_FRACTION);
    } finally {
        safeRelease(inv, opened, k);
    }
}

function extractLandmarks(cv: CvModule, gray: Mat, ink: Mat): Landmark[] {
    const greys = extractGreyFillLandmarks(cv, gray);
    const voids = extractVoidLandmarks(cv, ink);
    const polys = extractPolygonLandmarks(cv, ink);

    // Dedup: if a polygon heavily overlaps a void of similar area, keep the void
    // (voids are cleaner for courtyard matching).
    const keptPolys = polys.filter(p => {
        for (const v of voids) {
            const dx = p.cx - v.cx;
            const dy = p.cy - v.cy;
            if (Math.sqrt(dx * dx + dy * dy) < 0.04) {
                const ar = Math.min(p.areaFrac, v.areaFrac) / Math.max(p.areaFrac, v.areaFrac);
                if (ar > 0.6) return false;
            }
        }
        return true;
    });

    const ranked = [
        ...voids.sort((a, b) => b.area - a.area),
        ...greys.sort((a, b) => b.area - a.area),
        ...keptPolys.sort((a, b) => b.area - a.area),
    ];
    return ranked.slice(0, config.REGISTRATION_LANDMARK_MAX);
}

const LANDMARK_DEBUG_COLORS: Record<LandmarkKind, {b: number; g: number; r: number}> = {
    'void': {b: 0, g: 255, r: 255},       // yellow
    'grey-fill': {b: 0, g: 140, r: 255},   // orange
    'polygon': {b: 255, g: 0, r: 255},     // magenta
};

function drawLandmarkOn(cv: CvModule, img: Mat, lm: Landmark, index: number, matched: boolean): void {
    const base = LANDMARK_DEBUG_COLORS[lm.kind];
    const col = matched
        ? new cv.Vec3(0, 220, 0)
        : new cv.Vec3(base.b, base.g, base.r);
    const pts = lm.points.map(p => new cv.Point2(p.x, p.y));
    if (pts.length >= 2) {
        img.drawContours([pts], 0, col, matched ? 2 : 1);
    }
    img.drawCircle(new cv.Point2(lm.px, lm.py), 4, col, -1);
    img.drawRectangle(
        new cv.Point2(lm.bbox.x, lm.bbox.y),
        new cv.Point2(lm.bbox.x + lm.bbox.w, lm.bbox.y + lm.bbox.h),
        col,
        1
    );
    // Label: kind initial + index
    const tag = `${lm.kind[0]}${index}`;
    img.putText(
        tag,
        new cv.Point2(Math.max(2, lm.bbox.x), Math.max(14, lm.bbox.y - 4)),
        cv.FONT_HERSHEY_SIMPLEX,
        0.4,
        col,
        1
    );
}

/**
 * Debug: side-by-side thumb|master with *all* detected landmarks drawn
 * (polygons + centroids + labels). Written as `12c-landmarks-found.png`.
 */
function saveLandmarksFoundDebug(
    cv: CvModule,
    debugDir: string,
    thumbGray: Mat,
    masterGray: Mat,
    thumbLm: Landmark[],
    masterLm: Landmark[],
    logger: serverLogger,
): void {
    let thumbDbg: Mat | null = null;
    let masterDbg: Mat | null = null;
    let thumbPad: Mat | null = null;
    let masterPad: Mat | null = null;
    let composite: Mat | null = null;
    try {
        fs.mkdirSync(debugDir, {recursive: true});
        const GAP = 12;
        thumbDbg = thumbGray.channels === 1 ? thumbGray.cvtColor(cv.COLOR_GRAY2BGR) : thumbGray.copy();
        masterDbg = masterGray.channels === 1 ? masterGray.cvtColor(cv.COLOR_GRAY2BGR) : masterGray.copy();

        thumbLm.forEach((lm, i) => drawLandmarkOn(cv, thumbDbg!, lm, i, false));
        masterLm.forEach((lm, i) => drawLandmarkOn(cv, masterDbg!, lm, i, false));

        // Legend strip
        const legend = `void=yellow  grey-fill=orange  polygon=magenta  |  thumb:${thumbLm.length}  master:${masterLm.length}`;
        thumbDbg.putText(legend, new cv.Point2(8, 18), cv.FONT_HERSHEY_SIMPLEX, 0.45, new cv.Vec3(255, 255, 255), 1);

        const tW = thumbDbg.cols, tH = thumbDbg.rows;
        const mW = masterDbg.cols, mH = masterDbg.rows;
        const maxH = Math.max(tH, mH);
        thumbPad = thumbDbg.copyMakeBorder(0, maxH - tH, 0, GAP + mW, cv.BORDER_CONSTANT, new cv.Vec3(0, 0, 0));
        masterPad = masterDbg.copyMakeBorder(0, maxH - mH, tW + GAP, 0, cv.BORDER_CONSTANT, new cv.Vec3(0, 0, 0));
        composite = thumbPad.bitwiseOr(masterPad);
        cv.imwrite(path.join(debugDir, '12c-landmarks-found.png'), composite);
        logger.debug(
            `Registration: wrote 12c-landmarks-found.png (thumb=${thumbLm.length}, master=${masterLm.length})`
        );
    } catch (err) {
        logger.warn(`Failed to save landmarks debug: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        safeRelease(thumbDbg, masterDbg, thumbPad, masterPad, composite);
    }
}

/**
 * Match distinctive landmarks by searching each thumb landmark patch inside a *local*
 * neighborhood on the master (same relative page position ± POS_TOLERANCE).
 */
function tryLandmarkRegistration(
    cv: CvModule,
    thumbGray: Mat,
    masterGray: Mat,
    thumbInk: Mat,
    masterInk: Mat,
    logger: serverLogger,
    debugDir?: string,
): {
    Hmatch: number[];
    inliers: number;
    matches: Array<{ti: number; mi: number}>;
    thumbLandmarks: Landmark[];
    masterLandmarks: Landmark[];
} | null {
    const thumbLm = extractLandmarks(cv, thumbGray, thumbInk);
    const masterLm = extractLandmarks(cv, masterGray, masterInk);
    logger.debug(
        `Registration: landmarks thumb=${thumbLm.length} ` +
        `(grey=${thumbLm.filter(l => l.kind === 'grey-fill').length} ` +
        `void=${thumbLm.filter(l => l.kind === 'void').length} ` +
        `poly=${thumbLm.filter(l => l.kind === 'polygon').length}) ` +
        `master=${masterLm.length} ` +
        `(grey=${masterLm.filter(l => l.kind === 'grey-fill').length} ` +
        `void=${masterLm.filter(l => l.kind === 'void').length} ` +
        `poly=${masterLm.filter(l => l.kind === 'polygon').length})`
    );

    if (debugDir) {
        saveLandmarksFoundDebug(cv, debugDir, thumbGray, masterGray, thumbLm, masterLm, logger);
    }

    const minPairs = config.REGISTRATION_LANDMARK_MIN_MATCHES;
    const posTol = config.REGISTRATION_LANDMARK_POS_TOLERANCE;
    if (thumbLm.length < 1) return null;

    const ref = Math.min(masterGray.cols, masterGray.rows);
    const blurK = adaptiveOddKernel(0.01, ref, 3, 9);
    let masterBlur: Mat | null = null;
    let thumbBlur: Mat | null = null;
    const srcPts: Array<{x: number; y: number}> = [];
    const dstPts: Array<{x: number; y: number}> = [];
    const debugMatches: Array<{ti: number; mi: number}> = [];
    const matchedMasterLm: Landmark[] = [];

    try {
        masterBlur = masterGray.gaussianBlur(new cv.Size(blurK, blurK), 0);
        thumbBlur = thumbGray.gaussianBlur(new cv.Size(blurK, blurK), 0);

        const order = thumbLm
            .map((lm, ti) => ({ti, area: lm.area, kind: lm.kind}))
            .sort((a, b) => {
                const kr = (k: LandmarkKind) => (k === 'void' ? 0 : k === 'grey-fill' ? 1 : 2);
                return kr(a.kind) - kr(b.kind) || b.area - a.area;
            });

        for (const {ti} of order) {
            const lm = thumbLm[ti];
            const pad = Math.max(4, Math.round(Math.min(lm.bbox.w, lm.bbox.h) * 0.08));
            const x = Math.max(0, lm.bbox.x - pad);
            const y = Math.max(0, lm.bbox.y - pad);
            const tw = Math.min(thumbBlur.cols - x, lm.bbox.w + pad * 2);
            const th = Math.min(thumbBlur.rows - y, lm.bbox.h + pad * 2);
            if (tw < 16 || th < 16) continue;

            // Expected master location ≈ same normalized position (plans are similarly framed).
            const expCx = lm.cx * masterBlur.cols;
            const expCy = lm.cy * masterBlur.rows;
            const tolX = posTol * masterBlur.cols;
            const tolY = posTol * masterBlur.rows;

            let patch: Mat | null = null;
            try {
                patch = thumbBlur.getRegion(new cv.Rect(x, y, tw, th)).copy();
                let best: {score: number; mx: number; my: number; s: number; pw: number; ph: number} | null = null;

                for (const s of [0.92, 1.0, 1.08]) {
                    const pw = Math.max(12, Math.round(tw * s));
                    const ph = Math.max(12, Math.round(th * s));
                    if (pw >= masterBlur.cols || ph >= masterBlur.rows) continue;

                    // Local search window around expected position (not the whole master).
                    const searchCx = expCx;
                    const searchCy = expCy;
                    let rx = Math.floor(searchCx - tolX - pw / 2);
                    let ry = Math.floor(searchCy - tolY - ph / 2);
                    let rw = Math.ceil(2 * tolX + pw);
                    let rh = Math.ceil(2 * tolY + ph);
                    rx = Math.max(0, rx);
                    ry = Math.max(0, ry);
                    rw = Math.min(rw, masterBlur.cols - rx);
                    rh = Math.min(rh, masterBlur.rows - ry);
                    if (rw < pw || rh < ph) continue;

                    let scaled: Mat | null = null;
                    let roi: Mat | null = null;
                    let res: Mat | null = null;
                    try {
                        scaled = s === 1 ? patch : patch.resize(ph, pw, 0, 0, cv.INTER_AREA);
                        roi = masterBlur.getRegion(new cv.Rect(rx, ry, rw, rh));
                        res = roi.matchTemplate(scaled, cv.TM_CCOEFF_NORMED);
                        const {maxVal, maxLoc} = res.minMaxLoc();
                        if (!Number.isFinite(maxVal)) continue;
                        const mx = rx + maxLoc.x;
                        const my = ry + maxLoc.y;
                        // Matched patch center must stay near expected normalized position.
                        const matchCx = mx + pw / 2;
                        const matchCy = my + ph / 2;
                        const dNorm = Math.sqrt(
                            Math.pow((matchCx / masterBlur.cols) - lm.cx, 2) +
                            Math.pow((matchCy / masterBlur.rows) - lm.cy, 2)
                        );
                        if (dNorm > posTol * Math.SQRT2) continue;
                        if (!best || maxVal > best.score) {
                            best = {score: maxVal, mx, my, s, pw, ph};
                        }
                    } finally {
                        if (scaled && scaled !== patch) safeRelease(scaled);
                        // roi is a view — do not release
                        safeRelease(res);
                    }
                }

                if (!best || best.score < 0.45) {
                    logger.debug(
                        `Registration: landmark ${lm.kind}#${ti} @(${lm.cx.toFixed(2)},${lm.cy.toFixed(2)}) ` +
                        `local score=${best ? best.score.toFixed(3) : 'n/a'} — skip`
                    );
                    continue;
                }

                const thumbCx = lm.px;
                const thumbCy = lm.py;
                const localX = thumbCx - x;
                const localY = thumbCy - y;
                const masterCx = best.mx + localX * best.s;
                const masterCy = best.my + localY * best.s;

                srcPts.push({x: thumbCx, y: thumbCy});
                dstPts.push({x: masterCx, y: masterCy});
                for (const corner of lm.points.length >= 3 ? lm.points : [
                    {x: lm.bbox.x, y: lm.bbox.y},
                    {x: lm.bbox.x + lm.bbox.w, y: lm.bbox.y},
                    {x: lm.bbox.x, y: lm.bbox.y + lm.bbox.h},
                    {x: lm.bbox.x + lm.bbox.w, y: lm.bbox.y + lm.bbox.h},
                ]) {
                    const lx = corner.x - x;
                    const ly = corner.y - y;
                    srcPts.push(corner);
                    dstPts.push({x: best.mx + lx * best.s, y: best.my + ly * best.s});
                }

                const mi = matchedMasterLm.length;
                const shiftedPts = lm.points.map(p => ({
                    x: best!.mx + (p.x - x) * best!.s,
                    y: best!.my + (p.y - y) * best!.s,
                }));
                matchedMasterLm.push({
                    ...lm,
                    px: masterCx,
                    py: masterCy,
                    cx: masterCx / masterGray.cols,
                    cy: masterCy / masterGray.rows,
                    bbox: {x: best.mx, y: best.my, w: best.pw, h: best.ph},
                    points: shiftedPts.length >= 3 ? shiftedPts : [
                        {x: best.mx, y: best.my},
                        {x: best.mx + best.pw, y: best.my},
                        {x: best.mx + best.pw, y: best.my + best.ph},
                        {x: best.mx, y: best.my + best.ph},
                    ],
                });
                debugMatches.push({ti, mi});
                logger.debug(
                    `Registration: landmark ${lm.kind}#${ti} matched score=${best.score.toFixed(3)} ` +
                    `local @(${lm.cx.toFixed(2)},${lm.cy.toFixed(2)}) → (${masterCx.toFixed(0)},${masterCy.toFixed(0)})`
                );
            } finally {
                safeRelease(patch);
            }
        }

        if (debugMatches.length < minPairs) {
            logger.debug(`Registration: only ${debugMatches.length} local landmark matches — need ${minPairs}`);
            return null;
        }

        const src = srcPts.map(p => new cv.Point2(p.x, p.y));
        const dst = dstPts.map(p => new cv.Point2(p.x, p.y));
        const {out, inliers} = cv.estimateAffinePartial2D(src, dst, cv.RANSAC, 5.0);
        if (!out || out.empty) {
            logger.debug('Registration: landmark affine failed');
            safeRelease(out, inliers);
            return null;
        }
        const maskArr = inliers ? (inliers.getDataAsArray() as number[][]).flat() : src.map(() => 1);
        const inlierCount = maskArr.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
        const rows = out.getDataAsArray() as number[][];
        const a = rows[0][0], b = rows[0][1], tx = rows[0][2];
        const c = rows[1][0], d = rows[1][1], ty = rows[1][2];
        const s = Math.sqrt(a * a + c * c);
        safeRelease(out, inliers);
        if (!(s >= 0.45 && s <= 2.2)) {
            logger.debug(`Registration: landmark affine scale ${s.toFixed(3)} out of range`);
            return null;
        }
        if (inlierCount < Math.max(4, minPairs * 2)) {
            logger.debug(`Registration: landmark inliers ${inlierCount} too low`);
            return null;
        }

        return {
            Hmatch: [a, b, tx, c, d, ty, 0, 0, 1],
            inliers: inlierCount,
            matches: debugMatches,
            thumbLandmarks: thumbLm,
            masterLandmarks: matchedMasterLm.length ? matchedMasterLm : masterLm,
        };
    } finally {
        safeRelease(masterBlur, thumbBlur);
    }
}

type RegistrationDebug = {
    method: 'landmark' | 'template' | 'orb' | 'none';
    score?: number;
    templateRect?: {x: number; y: number; w: number; h: number};
    matchLoc?: {x: number; y: number};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orbMatches?: {thumbKp: any[]; masterKp: any[]; matches: any[]};
    landmarkMatches?: Array<{ti: number; mi: number}>;
    thumbLandmarks?: Landmark[];
    masterLandmarks?: Landmark[];
};

/**
 * Template-match thumb greyscale (content crop) inside master greyscale, with a small
 * scale pyramid. Binary ink is only used to find the content bbox.
 * Returns match-space similarity H or null.
 */
function tryTemplateRegistration(
    cv: CvModule,
    thumbGray: Mat,
    masterGray: Mat,
    thumbInkForBBox: Mat,
    logger: serverLogger,
): {Hmatch: number[]; score: number; templateRect: {x: number; y: number; w: number; h: number}; matchLoc: {x: number; y: number}} | null {
    const minScore = config.REGISTRATION_TEMPLATE_MIN_SCORE;
    const bbox = inkContentBBox(thumbInkForBBox);

    let ox = 0, oy = 0, tw = thumbGray.cols, th = thumbGray.rows;
    if (bbox) {
        const pad = 4;
        ox = Math.max(0, bbox.x - pad);
        oy = Math.max(0, bbox.y - pad);
        tw = Math.min(thumbGray.cols - ox, bbox.w + pad * 2);
        th = Math.min(thumbGray.rows - oy, bbox.h + pad * 2);
    }
    if (tw < 24 || th < 24) {
        logger.debug('Registration: template content bbox too small — skip matchTemplate');
        return null;
    }

    let baseTemplate: Mat | null = null;
    try {
        baseTemplate = thumbGray.getRegion(new cv.Rect(ox, oy, tw, th)).copy();

        // Soft CAD thumbs correlate better after a light blur on both sides.
        const blurK = adaptiveOddKernel(0.01, Math.min(masterGray.cols, masterGray.rows), 3, 9);
        let masterBlur: Mat | null = null;
        let baseBlur: Mat | null = null;
        try {
            masterBlur = masterGray.gaussianBlur(new cv.Size(blurK, blurK), 0);
            baseBlur = baseTemplate.gaussianBlur(new cv.Size(blurK, blurK), 0);

            let best: {
                score: number; mx: number; my: number; s: number; tw: number; th: number;
            } | null = null;

            for (const s of [0.88, 0.94, 1.0, 1.06, 1.12]) {
                const sw = Math.max(16, Math.round(tw * s));
                const sh = Math.max(16, Math.round(th * s));
                if (sw >= masterBlur.cols || sh >= masterBlur.rows) continue;

                let scaled: Mat | null = null;
                let result: Mat | null = null;
                try {
                    scaled = s === 1
                        ? baseBlur
                        : baseBlur.resize(sh, sw, 0, 0, cv.INTER_AREA);
                    result = masterBlur.matchTemplate(scaled, cv.TM_CCOEFF_NORMED);
                    const {maxVal, maxLoc} = result.minMaxLoc();
                    if (!Number.isFinite(maxVal)) continue;
                    if (!best || maxVal > best.score) {
                        best = {score: maxVal, mx: maxLoc.x, my: maxLoc.y, s, tw: sw, th: sh};
                    }
                } finally {
                    if (scaled && scaled !== baseBlur) safeRelease(scaled);
                    safeRelease(result);
                }
            }

            if (!best) {
                logger.debug('Registration: matchTemplate found no valid scale');
                return null;
            }

            logger.debug(
                `Registration: matchTemplate best score=${best.score.toFixed(3)} ` +
                `scale=${best.s.toFixed(2)} loc=(${best.mx},${best.my}) ` +
                `template=${best.tw}×${best.th} origin=(${ox},${oy})`
            );
            if (best.score < minScore) return null;

            // master = s * (thumb - origin) + matchLoc
            const tx = best.mx - best.s * ox;
            const ty = best.my - best.s * oy;
            const Hmatch = [best.s, 0, tx, 0, best.s, ty, 0, 0, 1];
            return {
                Hmatch,
                score: best.score,
                templateRect: {x: ox, y: oy, w: tw, h: th},
                matchLoc: {x: best.mx, y: best.my},
            };
        } finally {
            safeRelease(masterBlur, baseBlur);
        }
    } finally {
        safeRelease(baseTemplate);
    }
}

/**
 * ORB keypoints + Hamming knn ratio test + estimateAffinePartial2D (similarity).
 * Returns match-space H or null.
 */
function tryOrbRegistration(
    cv: CvModule,
    thumbInk: Mat,
    masterInk: Mat,
    logger: serverLogger,
): {Hmatch: number[]; inliers: number; debug: RegistrationDebug['orbMatches']} | null {
    const minInliers = config.REGISTRATION_ORB_MIN_INLIERS;
    let descT: Mat | null = null;
    let descM: Mat | null = null;
    let affineMat: Mat | null = null;
    let inlierMat: Mat | null = null;
    try {
        const orb = new cv.ORBDetector(2000);
        const kpT = orb.detect(thumbInk);
        const kpM = orb.detect(masterInk);
        if (kpT.length < 12 || kpM.length < 12) {
            logger.debug(`Registration: ORB too few keypoints (thumb=${kpT.length}, master=${kpM.length})`);
            return null;
        }
        descT = orb.compute(thumbInk, kpT);
        descM = orb.compute(masterInk, kpM);
        if (!descT || descT.empty || !descM || descM.empty) {
            logger.debug('Registration: ORB descriptors empty');
            return null;
        }

        const knn = cv.matchKnnBruteForceHamming(descT, descM, 2);
        const good: Array<{queryIdx: number; trainIdx: number}> = [];
        for (const pair of knn) {
            if (!pair || pair.length < 2) continue;
            const a = pair[0];
            const b = pair[1];
            if (!a || !b) continue;
            if (a.distance < 0.75 * b.distance) {
                good.push({queryIdx: a.queryIdx, trainIdx: a.trainIdx});
            }
        }
        if (good.length < minInliers) {
            logger.debug(`Registration: ORB good matches ${good.length} < ${minInliers}`);
            return null;
        }

        const srcPts = good.map(g => kpT[g.queryIdx].pt);
        const dstPts = good.map(g => kpM[g.trainIdx].pt);
        const {out, inliers} = cv.estimateAffinePartial2D(srcPts, dstPts, cv.RANSAC, 3.0);
        affineMat = out;
        inlierMat = inliers;
        if (!out || out.empty) {
            logger.debug('Registration: estimateAffinePartial2D failed');
            return null;
        }

        const maskArr = inliers ? (inliers.getDataAsArray() as number[][]).flat() : good.map(() => 1);
        const inlierCount = maskArr.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
        if (inlierCount < minInliers) {
            logger.debug(`Registration: ORB inliers ${inlierCount} < ${minInliers}`);
            return null;
        }

        // out is 2×3: [a b tx; c d ty]
        const rows = out.getDataAsArray() as number[][];
        const a = rows[0][0], b = rows[0][1], tx = rows[0][2];
        const c = rows[1][0], d = rows[1][1], ty = rows[1][2];
        const matchScale = Math.sqrt(a * a + c * c);
        if (!(matchScale >= 0.45 && matchScale <= 2.2)) {
            logger.debug(`Registration: ORB scale ${matchScale.toFixed(3)} out of range — reject`);
            return null;
        }
        const Hmatch = [a, b, tx, c, d, ty, 0, 0, 1];
        logger.debug(
            `Registration: ORB OK inliers=${inlierCount}/${good.length} ` +
            `affine scale≈${matchScale.toFixed(3)} shift=(${tx.toFixed(1)},${ty.toFixed(1)})`
        );

        const debugMatches = good
            .map((g, i) => ({g, ok: maskArr[i] > 0}))
            .filter(x => x.ok)
            .slice(0, 40)
            .map(x => ({queryIdx: x.g.queryIdx, trainIdx: x.g.trainIdx, distance: 0}));

        return {
            Hmatch,
            inliers: inlierCount,
            debug: {thumbKp: kpT, masterKp: kpM, matches: debugMatches},
        };
    } catch (err) {
        logger.debug(`Registration: ORB error: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    } finally {
        safeRelease(descT, descM, affineMat, inlierMat);
    }
}

/**
 * Registers the unit floor-plan thumbnail to the per-floor master floor plan:
 *   1. distinctive landmarks (grey fills / voids / circles)
 *   2. matchTemplate (greyscale, then ink)
 *   3. ORB + estimateAffinePartial2D
 * Returns the 3×3 homography (row-major flat) into full-res master, or null.
 *
 * Debug: `12-registration-matches.png` shows landmarks / template rect / ORB matches.
 */

function registerThumbnailToMaster(cv: CvModule, thumbPath: string, masterPath: string, logger: serverLogger, debugDir?: string): ThumbToMasterReg {
    let thumbGray: Mat | null = null;
    let masterGray: Mat | null = null;
    let masterGrayMatch: Mat | null = null;
    let thumbGrayMatch: Mat | null = null;
    let masterInk: Mat | null = null;
    let thumbInk: Mat | null = null;
    const regDebug: RegistrationDebug = {method: 'none'};

    try {
        thumbGray = cv.imread(thumbPath, cv.IMREAD_GRAYSCALE);
        masterGray = cv.imread(masterPath, cv.IMREAD_GRAYSCALE);
        if (thumbGray.empty || masterGray.empty) {
            logger.warn('Registration: could not read one of the images');
            return null;
        }

        const masterW = masterGray.cols;
        const masterH = masterGray.rows;
        const thumbW = thumbGray.cols;
        const thumbH = thumbGray.rows;

        let matchToFullScaleX = 1;
        let matchToFullScaleY = 1;
        thumbGrayMatch = thumbGray;
        masterGrayMatch = masterGray;

        if (config.REGISTRATION_DOWNSCALE_MASTER_TO_THUMB) {
            // Isotropic fit: longest side of master → longest side of thumb (no stretch).
            const scale = Math.min(1, Math.max(thumbW, thumbH) / Math.max(masterW, masterH));
            const mw = Math.max(1, Math.round(masterW * scale));
            const mh = Math.max(1, Math.round(masterH * scale));

            if (scale < 0.98) {
                masterGrayMatch = masterGray.resize(mh, mw, 0, 0, cv.INTER_AREA);
                matchToFullScaleX = masterW / mw;
                matchToFullScaleY = masterH / mh;
                logger.debug(
                    `Registration: downscaled master ${masterW}×${masterH} → ${mw}×${mh} ` +
                    `(isotropic ×${scale.toFixed(3)}; thumb ${thumbW}×${thumbH} may be cropped)`
                );
            }
        }

        // Greyscale for template correlation; structural ink for ORB + content bbox.
        masterInk = toStructuralInk(cv, masterGrayMatch);
        thumbInk = toStructuralInk(cv, thumbGrayMatch);
        logger.debug('Registration: structural ink ready; template uses greyscale, ORB uses ink');

        const bubT = suppressGridBubbles(cv, thumbInk);
        const bubM = suppressGridBubbles(cv, masterInk);
        if (bubT + bubM > 0) {
            logger.debug(`Registration: suppressed grid bubbles thumb=${bubT} master=${bubM}`);
        }

        if (debugDir) {
            try {
                fs.mkdirSync(debugDir, {recursive: true});
                cv.imwrite(path.join(debugDir, '12a-master-downscaled-for-registration.png'), masterInk);
                const gapPx = 8;
                const h = Math.max(thumbInk.rows, masterInk.rows);
                const thumbBgr = thumbInk.cvtColor(cv.COLOR_GRAY2BGR);
                const masterBgr = masterInk.cvtColor(cv.COLOR_GRAY2BGR);
                const thumbPad = thumbBgr.copyMakeBorder(
                    0, h - thumbBgr.rows, 0, gapPx + masterBgr.cols, cv.BORDER_CONSTANT, new cv.Vec3(0, 0, 0)
                );
                const masterPad = masterBgr.copyMakeBorder(
                    0, h - masterBgr.rows, thumbBgr.cols + gapPx, 0, cv.BORDER_CONSTANT, new cv.Vec3(0, 0, 0)
                );
                const sideBySide = thumbPad.bitwiseOr(masterPad);
                cv.imwrite(path.join(debugDir, '12b-thumb-vs-downscaled-master.png'), sideBySide);
                safeRelease(thumbBgr, masterBgr, thumbPad, masterPad, sideBySide);
            } catch (dbgErr) {
                logger.warn(`Failed to save downscaled master debug: ${dbgErr instanceof Error ? dbgErr.message : String(dbgErr)}`);
            }
        }

        const landmarks = tryLandmarkRegistration(
            cv, thumbGrayMatch, masterGrayMatch, thumbInk, masterInk, logger, debugDir
        );
        if (landmarks) {
            regDebug.method = 'landmark';
            regDebug.landmarkMatches = landmarks.matches;
            regDebug.thumbLandmarks = landmarks.thumbLandmarks;
            regDebug.masterLandmarks = landmarks.masterLandmarks;
            const H = liftMatchHomographyToFull(landmarks.Hmatch, matchToFullScaleX, matchToFullScaleY);
            const a = H[0], b = H[3], tx = H[2], ty = H[5];
            logger.debug(
                `Registration OK (landmark): ${landmarks.matches.length} pairs, ${landmarks.inliers} inliers, ` +
                `similarity≈scale ${Math.sqrt(a * a + b * b).toFixed(3)} shift (${tx.toFixed(1)}, ${ty.toFixed(1)}) ` +
                `master ${masterW}×${masterH}`
            );
            return {H, masterW, masterH};
        }

        const tmplGray = tryTemplateRegistration(cv, thumbGrayMatch, masterGrayMatch, thumbInk, logger);
        const tmpl = tmplGray ?? tryTemplateRegistration(cv, thumbInk, masterInk, thumbInk, logger);
        if (tmpl) {
            const via = tmplGray ? 'greyscale' : 'ink';
            regDebug.method = 'template';
            regDebug.score = tmpl.score;
            regDebug.templateRect = tmpl.templateRect;
            regDebug.matchLoc = tmpl.matchLoc;
            const H = liftMatchHomographyToFull(tmpl.Hmatch, matchToFullScaleX, matchToFullScaleY);
            logger.debug(
                `Registration OK (template/${via}): score=${tmpl.score.toFixed(3)} ` +
                `match_scale=${tmpl.Hmatch[0].toFixed(3)} ` +
                `shift_match=(${tmpl.Hmatch[2].toFixed(1)},${tmpl.Hmatch[5].toFixed(1)}) ` +
                `full_scale≈(${matchToFullScaleX.toFixed(3)},${matchToFullScaleY.toFixed(3)}) ` +
                `master ${masterW}×${masterH}`
            );
            return {H, masterW, masterH};
        }

        const orb = tryOrbRegistration(cv, thumbInk, masterInk, logger);
        if (orb) {
            regDebug.method = 'orb';
            regDebug.orbMatches = orb.debug;
            const H = liftMatchHomographyToFull(orb.Hmatch, matchToFullScaleX, matchToFullScaleY);
            const a = H[0], b = H[3], tx = H[2], ty = H[5];
            logger.debug(
                `Registration OK (orb): inliers=${orb.inliers} ` +
                `similarity≈scale ${Math.sqrt(a * a + b * b).toFixed(3)} shift (${tx.toFixed(1)}, ${ty.toFixed(1)}) ` +
                `master ${masterW}×${masterH}`
            );
            return {H, masterW, masterH};
        }

        logger.warn('Registration: landmark, matchTemplate, and ORB all failed');
        return null;
    } catch (err) {
        logger.warn(`Registration error: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    } finally {
        const dbgInkT = thumbInk;
        const dbgInkM = masterInk;
        if (debugDir && dbgInkT && !dbgInkT.empty && dbgInkM && !dbgInkM.empty) {
            let thumbDbg: Mat | null = null;
            let masterDbg: Mat | null = null;
            let thumbPadded: Mat | null = null;
            let masterPadded: Mat | null = null;
            let composite: Mat | null = null;
            try {
                fs.mkdirSync(debugDir, {recursive: true});
                const GAP = 10;
                const tW = dbgInkT.cols;
                const tH = dbgInkT.rows;
                const mW = dbgInkM.cols;
                const mH = dbgInkM.rows;
                const maxH = Math.max(tH, mH);

                thumbDbg = dbgInkT.cvtColor(cv.COLOR_GRAY2BGR);
                masterDbg = dbgInkM.cvtColor(cv.COLOR_GRAY2BGR);

                const green = new cv.Vec3(0, 220, 0);
                const cyan = new cv.Vec3(220, 220, 0);
                const orange = new cv.Vec3(0, 140, 255);

                if (regDebug.method === 'landmark' && regDebug.thumbLandmarks && regDebug.masterLandmarks) {
                    const matchedT = new Set((regDebug.landmarkMatches ?? []).map(m => m.ti));
                    const matchedM = new Set((regDebug.landmarkMatches ?? []).map(m => m.mi));
                    regDebug.thumbLandmarks.forEach((lm, i) => drawLandmarkOn(cv, thumbDbg!, lm, i, matchedT.has(i)));
                    regDebug.masterLandmarks.forEach((lm, i) => drawLandmarkOn(cv, masterDbg!, lm, i, matchedM.has(i)));
                } else if (regDebug.method === 'template' && regDebug.templateRect && regDebug.matchLoc) {
                    const tr = regDebug.templateRect;
                    const ml = regDebug.matchLoc;
                    thumbDbg.drawRectangle(
                        new cv.Point2(tr.x, tr.y),
                        new cv.Point2(tr.x + tr.w, tr.y + tr.h),
                        green,
                        2
                    );
                    masterDbg.drawRectangle(
                        new cv.Point2(ml.x, ml.y),
                        new cv.Point2(ml.x + tr.w, ml.y + tr.h),
                        green,
                        2
                    );
                }

                thumbPadded = thumbDbg.copyMakeBorder(0, maxH - tH, 0, GAP + mW, cv.BORDER_CONSTANT, new cv.Vec3(0, 0, 0));
                masterPadded = masterDbg.copyMakeBorder(0, maxH - mH, tW + GAP, 0, cv.BORDER_CONSTANT, new cv.Vec3(0, 0, 0));
                safeRelease(thumbDbg, masterDbg);
                thumbDbg = null;
                masterDbg = null;

                composite = thumbPadded.bitwiseOr(masterPadded);
                safeRelease(thumbPadded, masterPadded);
                thumbPadded = null;
                masterPadded = null;

                const xOffset = tW + GAP;
                if (regDebug.method === 'landmark' && regDebug.landmarkMatches && regDebug.thumbLandmarks && regDebug.masterLandmarks) {
                    for (const {ti, mi} of regDebug.landmarkMatches) {
                        const ta = regDebug.thumbLandmarks[ti];
                        const ma = regDebug.masterLandmarks[mi];
                        composite.drawLine(
                            new cv.Point2(ta.px, ta.py),
                            new cv.Point2(ma.px + xOffset, ma.py),
                            cyan,
                            2
                        );
                    }
                } else if (regDebug.method === 'template' && regDebug.templateRect && regDebug.matchLoc) {
                    const tr = regDebug.templateRect;
                    const ml = regDebug.matchLoc;
                    const pt1 = new cv.Point2(tr.x + tr.w / 2, tr.y + tr.h / 2);
                    const pt2 = new cv.Point2(ml.x + tr.w / 2 + xOffset, ml.y + tr.h / 2);
                    composite.drawLine(pt1, pt2, cyan, 2);
                } else if (regDebug.method === 'orb' && regDebug.orbMatches) {
                    const {thumbKp, masterKp, matches} = regDebug.orbMatches;
                    for (const m of matches) {
                        const p1 = thumbKp[m.queryIdx]?.pt;
                        const p2 = masterKp[m.trainIdx]?.pt;
                        if (!p1 || !p2) continue;
                        composite.drawLine(
                            new cv.Point2(p1.x, p1.y),
                            new cv.Point2(p2.x + xOffset, p2.y),
                            orange,
                            1
                        );
                    }
                }

                cv.imwrite(path.join(debugDir, '12-registration-matches.png'), composite);
            } catch (dbgErr) {
                logger.warn(`Failed to save registration debug image: ${dbgErr instanceof Error ? dbgErr.message : String(dbgErr)}`);
            } finally {
                safeRelease(thumbDbg, masterDbg, thumbPadded, masterPadded, composite);
            }
        }
        if (masterGrayMatch && masterGrayMatch !== masterGray) safeRelease(masterGrayMatch);
        safeRelease(masterInk, thumbInk, thumbGray, masterGray);
        // thumbGrayMatch aliases thumbGray — already released
    }
}

/**
 * Extracts the highlighted unit polygon from a unit floor-plan thumbnail.
 *
 * When `masterPlanPath` is provided:
 *   1. Prefer landmark / template / ORB registration → master-space coords
 *   2. Else floor-cached registration from another unit on the same floor
 *   3. Else simple scale of the highlight onto the master (same framing assumption)
 *
 * `registeredToMaster` is true for (1)–(3). Only false when no master exists.
 */
export async function extractHighlightPolygonsOpencv4(imagePath: string, masterPlanPath: string | undefined, debugPath: string, parentLogger: serverLogger, timer: PerformanceTimer, fallbackRegistration?: ThumbMasterRegistration): Promise<HighlightExtractionOpencv4Result> {
    const empty: HighlightExtractionOpencv4Result = {unitPolygon: undefined, allPolygons: [], allPolygonAreas: [], registeredToMaster: false, registrationSource: 'none'};
    return timer.timeAsync('extractHighlightPolygonsOpencv4', async () => {
        const logger = getLogger('extract_highlight_polygon_opencv4', parentLogger);
        logger.start(`Extracting highlight polygons (opencv4nodejs) from ${imagePath}`);

        const cv = loadCv();
        if (!cv) {
            logger.warn('@u4/opencv4nodejs could not be loaded (native OpenCV missing?)');
            return empty;
        }

        if (!fs.existsSync(imagePath)) {
            logger.warn(`Image file not found: ${imagePath}`);
            return empty;
        }

        if (config.SAVE_HIGHLIGHT_DEBUG_ARTIFACTS) {
            ensureDir(debugPath, logger);
            logger.debug(`Writing highlight pipeline debug PNGs to ${debugPath}`);
        }

        let bgr: Mat | null = null;
        let hsv: Mat | null = null;
        let hsvWork: Mat | null = null;
        let mask: Mat | null = null;
        let closeKernel: Mat | null = null;
        let openKernel: Mat | null = null;
        let dilateKernel: Mat | null = null;
        let tmp: Mat | null = null;

        try {
            bgr = cv.imread(imagePath, cv.IMREAD_COLOR);
            if (bgr.empty) {
                logger.warn('imread returned empty Mat');
                return empty;
            }

            const w = bgr.cols;
            const h = bgr.rows;
            const refDim = Math.min(w, h);
            logger.debug(`Image dimensions: ${w}x${h}`);

            saveHighlightDebugMat(cv, debugPath, '01-bgr.png', bgr);

            hsv = bgr.cvtColor(cv.COLOR_BGR2HSV);
            safeRelease(bgr);
            bgr = null;

            const blurSize = adaptiveOddKernel(DEFAULT_HIGHLIGHT_CONFIG.blurFraction, refDim, 3, 21);
            if (blurSize > 0) {
                hsvWork = hsv!.gaussianBlur(new cv.Size(blurSize, blurSize), 0);
                safeRelease(hsv);
                hsv = null;
            } else {
                hsvWork = hsv;
                hsv = null;
            }

            if (config.SAVE_HIGHLIGHT_DEBUG_ARTIFACTS) {
                const hsvViz = hsvWork!.cvtColor(cv.COLOR_HSV2BGR);
                saveHighlightDebugMat(cv, debugPath, '02-hsv-blur-as-bgr.png', hsvViz);
                hsvViz.release();
            }

            mask = buildHighlightMaskHsv(hsvWork!, DEFAULT_HIGHLIGHT_CONFIG, cv);
            safeRelease(hsvWork);
            hsvWork = null;

            saveHighlightDebugMat(cv, debugPath, '03-mask-hsv-inrange.png', mask!);

            const closeSize = adaptiveOddKernel(DEFAULT_HIGHLIGHT_CONFIG.closeKernelFraction, refDim, 5, 51);
            const openSize = adaptiveOddKernel(DEFAULT_HIGHLIGHT_CONFIG.openKernelFraction, refDim, 3, 11);
            const dilateSize = adaptiveOddKernel(DEFAULT_HIGHLIGHT_CONFIG.finalDilateFraction, refDim, 3, 11);
            logger.debug(
                `Adaptive kernels: blur=${blurSize}, close=${closeSize}, open=${openSize}, dilate=${dilateSize}`
            );

            closeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(closeSize, closeSize));
            tmp = mask!.morphologyEx(closeKernel, cv.MORPH_CLOSE, new cv.Point2(-1, -1));
            safeRelease(mask, closeKernel);
            mask = tmp;
            tmp = null;
            closeKernel = null;

            saveHighlightDebugMat(cv, debugPath, '04-mask-after-close.png', mask!);

            if (openSize > 0) {
                openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(openSize, openSize));
                tmp = mask!.morphologyEx(openKernel, cv.MORPH_OPEN, new cv.Point2(-1, -1));
                safeRelease(mask, openKernel);
                mask = tmp;
                tmp = null;
                openKernel = null;
                saveHighlightDebugMat(cv, debugPath, '05-mask-after-open.png', mask!);
            }

            if (dilateSize > 0) {
                dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(dilateSize, dilateSize));
                tmp = mask!.dilate(dilateKernel, new cv.Point2(-1, -1));
                safeRelease(mask, dilateKernel);
                mask = tmp;
                tmp = null;
                dilateKernel = null;
                saveHighlightDebugMat(cv, debugPath, '06-mask-after-dilate.png', mask!);
            }

            saveHighlightDebugMat(cv, debugPath, '07-mask-after-morph-before-thickness-filter.png', mask!);

            const minInteriorDistConfigured = config.HIGHLIGHT_MASK_MIN_DISTANCE_TO_BACKGROUND_PX;
            // Cap thickness filter to ~1% of min dim so small / fragmented teal fills survive.
            const minInteriorDist =
                minInteriorDistConfigured > 0
                    ? Math.min(minInteriorDistConfigured, Math.max(2, Math.round(refDim * 0.01)))
                    : 0;
            if (minInteriorDist > 0) {
                const dist = mask!.distanceTransform(cv.DIST_L2, cv.DIST_MASK_5);
                const thickF = dist.threshold(minInteriorDist, 255, cv.THRESH_BINARY);
                safeRelease(dist);
                const thickU8 = thickF.convertTo(cv.CV_8UC1);
                safeRelease(thickF);

                // Same pixels as `08-mask-after-min-interior-distance.png`; findContours can alter its input Mat.
                const expansionSeed = thickU8.copy();
                saveHighlightDebugMat(cv, debugPath, '08-mask-after-min-interior-distance.png', expansionSeed);

                const probe = thickU8.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                if (probe.length === 0) {
                    logger.warn(
                        `HIGHLIGHT_MASK_MIN_DISTANCE_TO_BACKGROUND_PX=${minInteriorDist} removed all mask pixels; using pre-thickness mask`
                    );
                    thickU8.release();
                    expansionSeed.release();
                } else {
                    thickU8.release();
                    safeRelease(mask);

                    const dilIters = Math.min(Math.max(1, Math.round(minInteriorDist / 2)), 64);
                    mask = dilateMaskOnly(cv, expansionSeed, dilIters);

                    logger.debug(
                        `09 = ${dilIters}× 3×3 dilate of 08 only (≈T/2 steps, T=${minInteriorDist})`
                    );
                    saveHighlightDebugMat(cv, debugPath, '09-mask-after-thickness-compensation.png', mask!);
                }
            }

            const contours = mask!.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            safeRelease(mask);
            mask = null;

            if (contours.length === 0) {
                logger.warn('No highlight region found (HSV mask empty)');
                return empty;
            }

            const minArea = Math.max(50, 0.0005 * w * h);
            const sorted = [...contours].sort((a, b) => b.area - a.area);
            const aboveNoise = sorted.filter((c) => c.area >= minArea);

            const {polygons: allPolygons, areas: allPolygonAreas} = buildAllOverlayPolygons(
                aboveNoise,
                w,
                h,
                DEFAULT_HIGHLIGHT_CONFIG,
                HIGHLIGHT_OVERLAY_MAX_REGIONS
            );

            if (aboveNoise.length === 0) {
                logger.warn(
                    `No contour above noise floor (${minArea.toFixed(0)} px²); treating as no highlight.`
                );
                return {unitPolygon: undefined, allPolygons, allPolygonAreas, registeredToMaster: false, registrationSource: 'none'};
            }

            const largest = aboveNoise[0];
            logger.debug(`Chosen largest contour area: ${largest.area.toFixed(0)} px²`);

            const arcLen = largest.arcLength(true);
            const epsilon = DEFAULT_HIGHLIGHT_CONFIG.approxPolyEpsilonFraction * arcLen;
            const pts = largest.approxPolyDP(epsilon, true);
            logger.debug(
                `approxPolyDP: ${pts.length} vertices (epsilon=${epsilon.toFixed(2)}, arc=${arcLen.toFixed(0)})`
            );

            if (pts.length < 3) {
                logger.warn(`Too few points after approximation: ${pts.length}`);
                return {unitPolygon: undefined, allPolygons, allPolygonAreas, registeredToMaster: false, registrationSource: 'none'};
            }

            const points: PolygonPoint[] = pts.map((p) => ({x: p.x, y: p.y}));
            const ordered = ensureConsistentOrdering(points, true);
            const thumbPolygon = toRelativePolygonPoints(ordered, w, h);
            let unitPolygon = thumbPolygon;
            let registeredToMaster = false;
            let computedRegistration: ThumbMasterRegistration | undefined;
            let usedReg: ThumbMasterRegistration | undefined;
            /** 'fresh' | 'floor-fallback' | 'scale-fallback' | 'none' */
            let regSource: 'fresh' | 'floor-fallback' | 'scale-fallback' | 'none' = 'none';

            if (masterPlanPath && fs.existsSync(masterPlanPath)) {
                const freshReg = registerThumbnailToMaster(cv, imagePath, masterPlanPath, logger, config.SAVE_HIGHLIGHT_DEBUG_ARTIFACTS ? debugPath : undefined);
                if (freshReg) {
                    computedRegistration = freshReg;
                    usedReg = freshReg;
                } else if (fallbackRegistration) {
                    logger.debug('Registration failed; applying floor-level cached homography as fallback');
                    usedReg = fallbackRegistration;
                }
            }

            if (usedReg) {
                const remapped = remapFractionalPolygon(thumbPolygon, w, h, usedReg.H, usedReg.masterW, usedReg.masterH);
                if (remapped && remapped.length >= 3) {
                    unitPolygon = remapped;
                    registeredToMaster = true;
                    regSource = computedRegistration ? 'fresh' : 'floor-fallback';
                } else {
                    logger.warn('Registration produced degenerate polygon; will try scale fallback');
                }
            }

            // Registration missing/degenerate: still place the highlight on the master via simple scale.
            if (!registeredToMaster && masterPlanPath && fs.existsSync(masterPlanPath)) {
                const masterSize = await readImageSize(masterPlanPath);
                if (masterSize) {
                    unitPolygon = scaleThumbnailPolygonToMaster(
                        thumbPolygon,
                        w,
                        h,
                        masterSize.width,
                        masterSize.height,
                    );
                    registeredToMaster = true;
                    regSource = 'scale-fallback';
                    logger.debug(
                        `Registration unavailable; scaled highlight polygon to master ` +
                        `(${w}×${h} → ${masterSize.width}×${masterSize.height})`
                    );
                } else {
                    logger.warn('Could not read master dimensions for scale fallback; keeping thumbnail-space coords');
                }
            }

            if (config.SAVE_HIGHLIGHT_DEBUG_ARTIFACTS && debugPath) {
                await savePolygonDebugOverlay(
                    imagePath,
                    [thumbPolygon],
                    path.join(debugPath, '10-polygon-on-unit-thumbnail.png'),
                    logger,
                );
                if (registeredToMaster && masterPlanPath) {
                    const suffix =
                        regSource === 'fresh' ? '' :
                        regSource === 'floor-fallback' ? '-fallback' :
                        '-scale-fallback';
                    await savePolygonDebugOverlay(
                        masterPlanPath,
                        [unitPolygon],
                        path.join(debugPath, `11-polygon-on-master-floor-plan${suffix}.png`),
                        logger,
                    );
                }
            }

            logger.finish(
                `Successfully extracted unit polygon (${unitPolygon.length} pts, registeredToMaster=${registeredToMaster}, reg=${regSource}); overlay has ${allPolygons.length} region(s)`
            );
            return {unitPolygon, allPolygons, allPolygonAreas, registeredToMaster, registrationSource: regSource, computedRegistration};
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`extractHighlightPolygonsOpencv4 failed: ${msg}`);
            return empty;
        } finally {
            safeRelease(tmp, mask, hsvWork, hsv, bgr, closeKernel, openKernel, dilateKernel);
        }
    });
}
