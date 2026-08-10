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
 * When line-based registration fails, map the highlight polygon onto the master
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

type LineSegment = {
    x1: number; y1: number; x2: number; y2: number;
    cx: number; cy: number;
    angle: number; length: number;
};

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
 * Hough line segments from a structural ink (or greyscale) image.
 * Prefers long/major walls — furniture, labels, and short grid ticks are filtered out.
 */
function extractLineSegments(cv: CvModule, gray: Mat): LineSegment[] {
    const w = gray.cols;
    const h = gray.rows;
    const refDim = Math.min(w, h);
    let work: Mat | null = null;
    try {
        // Ink map is already edge-like; a light dilate joins broken wall strokes.
        const k2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        work = gray.dilate(k2, new cv.Point2(-1, -1));
        k2.release();

        const minFrac = config.REGISTRATION_MIN_LINE_LENGTH_FRACTION;
        const maxSegs = config.REGISTRATION_MAX_SEGMENTS;
        // Big walls only — short interior partitions / furniture do not participate.
        const minLineLen = Math.max(24, Math.round(refDim * minFrac));
        const maxLineGap = Math.max(5, Math.round(refDim * 0.015));
        // Higher threshold → more votes required → more certain lines.
        const threshold = Math.max(35, Math.round(refDim * 0.05));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lines: any[] = work.houghLinesP(1, Math.PI / 180, threshold, minLineLen, maxLineGap);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const segments: LineSegment[] = lines.map((v: any) => {
            const x1 = v.w, y1 = v.x, x2 = v.y, y2 = v.z;
            const dx = x2 - x1, dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            if (angle < 0) angle += 180;
            return {x1, y1, x2, y2, cx: (x1 + x2) / 2 / w, cy: (y1 + y2) / 2 / h, angle, length};
        });
        segments.sort((a, b) => b.length - a.length);
        return segments.slice(0, maxSegs);
    } finally {
        safeRelease(work);
    }
}

/**
 * Greedy angle+position matching between thumb and master segments.
 * Uses normalized centers so scale difference between images doesn't matter.
 *
 * When `skipPositionCheck` is true, only angle similarity is used for matching.
 * This is the fallback mode for partial-crop thumbnails where the same wall
 * appears at very different normalized positions in the two images.
 * RANSAC in the caller rejects position-inconsistent matches as outliers.
 */
function matchSegmentsByAngleAndPosition(
    thumbSegs: LineSegment[],
    masterSegs: LineSegment[],
    skipPositionCheck = false,
): Array<{ti: number; mi: number}> {
    const MAX_ANGLE_DEG = 3;
    const MAX_POS_NORM = 0.07;
    const used = new Set<number>();
    const matches: Array<{ti: number; mi: number}> = [];
    // Prefer matching longer (more certain) thumb segments first.
    const order = thumbSegs
        .map((s, ti) => ({ti, length: s.length}))
        .sort((a, b) => b.length - a.length);
    for (const {ti} of order) {
        const ts = thumbSegs[ti];
        let bestMi = -1;
        let bestScore = Infinity;
        for (let mi = 0; mi < masterSegs.length; mi++) {
            if (used.has(mi)) continue;
            const ms = masterSegs[mi];
            // Length ratio gate — reject clearly mismatched wall sizes.
            const lenRatio = Math.min(ts.length, ms.length) / Math.max(ts.length, ms.length);
            if (lenRatio < 0.45) continue;
            let angleDiff = Math.abs(ts.angle - ms.angle);
            if (angleDiff > 90) angleDiff = 180 - angleDiff;
            if (angleDiff > MAX_ANGLE_DEG) continue;
            if (!skipPositionCheck) {
                const dcx = ts.cx - ms.cx;
                const dcy = ts.cy - ms.cy;
                const posDist = Math.sqrt(dcx * dcx + dcy * dcy);
                if (posDist > MAX_POS_NORM) continue;
                const score = angleDiff / MAX_ANGLE_DEG + posDist / MAX_POS_NORM + (1 - lenRatio);
                if (score < bestScore) { bestScore = score; bestMi = mi; }
            } else {
                const score = angleDiff / MAX_ANGLE_DEG + (1 - lenRatio);
                if (score < bestScore) { bestScore = score; bestMi = mi; }
            }
        }
        if (bestMi >= 0) { used.add(bestMi); matches.push({ti, mi: bestMi}); }
    }
    return matches;
}

/**
 * Registers the unit floor-plan thumbnail to the per-floor master floor plan using
 * line segment matching (Canny → HoughLinesP → angle+position greedy match) + RANSAC homography.
 * Returns the 3×3 homography (row-major flat) and master dimensions, or null when registration
 * cannot be established.
 *
 * When `debugDir` is provided, saves `12-registration-matches.png` showing:
 *   - grey lines:  unmatched segments on both sides
 *   - green lines: matched segments on both sides
 *   - cyan lines:  connecting lines between matched segment centers
 */

/**
 * Closed-form least-squares similarity transform (4 DOF: isotropic scale + rotation + translation)
 * from point correspondences selected by a binary inlier mask (0 = outlier, >0 = inlier).
 *
 * Model: [a, -b, tx; b, a, ty; 0, 0, 1] where a = s·cosθ, b = s·sinθ.
 * Returns the flat row-major 3×3 matrix, or null when fewer than 2 inliers or degenerate.
 *
 * Derivation: setting up normal equations for the overdetermined linear system
 *   a·xi − b·yi + tx = xi'
 *   b·xi + a·yi + ty = yi'
 * and solving analytically (Umeyama / Horn closed form).
 */
function estimateSimilarityLeastSquares(
    src: {x: number; y: number}[],
    dst: {x: number; y: number}[],
    inlierMask: number[],
): number[] | null {
    let n = 0, S = 0, Sx = 0, Sy = 0, Sxp = 0, Syp = 0, Sxxp = 0, Sxyp = 0;
    for (let i = 0; i < src.length; i++) {
        if (inlierMask[i] <= 0) continue;
        const xi = src[i].x, yi = src[i].y;
        const xip = dst[i].x, yip = dst[i].y;
        n++;
        S    += xi * xi + yi * yi;
        Sx   += xi;   Sy   += yi;
        Sxp  += xip;  Syp  += yip;
        Sxxp += xi * xip + yi * yip;
        Sxyp += -yi * xip + xi * yip;
    }
    if (n < 2) return null;
    const denom = n * S - Sx * Sx - Sy * Sy;
    if (Math.abs(denom) < 1e-9) return null;
    const a  = (n * Sxxp - Sx * Sxp - Sy * Syp) / denom;
    const b  = (n * Sxyp + Sy * Sxp - Sx * Syp) / denom;
    const tx = (Sxp - a * Sx + b * Sy) / n;
    const ty = (Syp - b * Sx - a * Sy) / n;
    return [a, -b, tx, b, a, ty, 0, 0, 1];
}

function registerThumbnailToMaster(cv: CvModule, thumbPath: string, masterPath: string, logger: serverLogger, debugDir?: string): ThumbToMasterReg {
    let thumbGray: Mat | null = null;
    let masterGray: Mat | null = null;
    let masterMatch: Mat | null = null;
    let thumbMatch: Mat | null = null;
    let homoMat: Mat | null = null;
    let maskMat: Mat | null = null;

    let thumbSegs: LineSegment[] = [];
    /** Master segments in *match* (downscaled) pixel space — used for debug overlay. */
    let masterMatchSegs: LineSegment[] = [];
    /** Master segments lifted to full-res pixel space — used for homography dst. */
    let masterSegs: LineSegment[] = [];
    let segMatches: Array<{ti: number; mi: number}> = [];

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

        // Soft unit thumbs lack the fine edges of a high-DPI master. Match at thumb size,
        // then convert BOTH to crisp binary structural ink (not soft blur / grey anti-alias).
        let matchToFullScaleX = 1;
        let matchToFullScaleY = 1;
        masterMatch = masterGray;
        thumbMatch = thumbGray;

        if (config.REGISTRATION_DOWNSCALE_MASTER_TO_THUMB) {
            const thumbAspect = thumbW / Math.max(1, thumbH);
            const masterAspect = masterW / Math.max(1, masterH);
            const aspectsClose = Math.abs(thumbAspect - masterAspect) / masterAspect < 0.05;

            // Prefer exact thumb W×H when letterboxing already aligned aspects — identical framing.
            const mw = aspectsClose
                ? thumbW
                : Math.max(1, Math.round(masterW * Math.min(1, Math.max(thumbW, thumbH) / Math.max(masterW, masterH))));
            const mh = aspectsClose
                ? thumbH
                : Math.max(1, Math.round(masterH * (mw / masterW)));

            let masterResized: Mat = masterGray;
            if (mw < masterW * 0.98 || mh < masterH * 0.98) {
                masterResized = masterGray.resize(mh, mw, 0, 0, cv.INTER_AREA);
                matchToFullScaleX = masterW / mw;
                matchToFullScaleY = masterH / mh;
                logger.debug(
                    `Registration: downscaled master ${masterW}×${masterH} → ${mw}×${mh} ` +
                    `(sx=${matchToFullScaleX.toFixed(2)}, sy=${matchToFullScaleY.toFixed(2)}) ` +
                    `to match thumb ${thumbW}×${thumbH}`
                );
            }

            // Crisp binary ink on both sides — restores sharp strokes after downscale.
            masterMatch = toStructuralInk(cv, masterResized);
            if (masterResized !== masterGray) safeRelease(masterResized);
            thumbMatch = toStructuralInk(cv, thumbGray);
            logger.debug('Registration: converted thumb + master to structural ink (binary walls)');
        }

        if (debugDir) {
            try {
                fs.mkdirSync(debugDir, {recursive: true});
                cv.imwrite(path.join(debugDir, '12a-master-downscaled-for-registration.png'), masterMatch);
                // Same-size side-by-side so quality difference is obvious at a glance.
                const gapPx = 8;
                const h = Math.max(thumbMatch.rows, masterMatch.rows);
                const thumbBgr = thumbMatch.channels === 1 ? thumbMatch.cvtColor(cv.COLOR_GRAY2BGR) : thumbMatch.copy();
                const masterBgr = masterMatch.channels === 1 ? masterMatch.cvtColor(cv.COLOR_GRAY2BGR) : masterMatch.copy();
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

        thumbSegs = extractLineSegments(cv, thumbMatch);
        masterMatchSegs = extractLineSegments(cv, masterMatch);

        // Lift master segment endpoints to full-resolution pixel space for the homography.
        // Recompute normalized cx/cy against full master for position matching consistency.
        masterSegs = masterMatchSegs.map((s) => {
            const x1 = s.x1 * matchToFullScaleX;
            const y1 = s.y1 * matchToFullScaleY;
            const x2 = s.x2 * matchToFullScaleX;
            const y2 = s.y2 * matchToFullScaleY;
            return {
                x1, y1, x2, y2,
                cx: (x1 + x2) / 2 / masterW,
                cy: (y1 + y2) / 2 / masterH,
                angle: s.angle,
                length: s.length * Math.max(matchToFullScaleX, matchToFullScaleY),
            };
        });

        if (thumbSegs.length < 8 || masterSegs.length < 8) {
            logger.warn(`Registration: too few line segments (thumb=${thumbSegs.length}, master=${masterSegs.length})`);
            return null;
        }

        // Position matching uses normalized coords — prefer match-space master segs (same framing as thumb).
        let usedAngleOnlyMatching = false;
        segMatches = matchSegmentsByAngleAndPosition(thumbSegs, masterMatchSegs);

        if (segMatches.length < 4) {
            logger.debug(`Position-based matching insufficient (${segMatches.length} matches); retrying with angle-only matching`);
            segMatches = matchSegmentsByAngleAndPosition(thumbSegs, masterMatchSegs, true);
            usedAngleOnlyMatching = true;
            if (segMatches.length < 4) {
                logger.warn(`Registration: too few matched segments even without position constraint (${segMatches.length})`);
                return null;
            }
        }

        // Build point correspondences — thumb pixels → full-res master pixels.
        const srcRaw = segMatches.flatMap(({ti}) => [
            {x: thumbSegs[ti].x1, y: thumbSegs[ti].y1},
            {x: thumbSegs[ti].x2, y: thumbSegs[ti].y2},
        ]);
        const dstRaw = segMatches.flatMap(({mi}) => [
            {x: masterSegs[mi].x1, y: masterSegs[mi].y1},
            {x: masterSegs[mi].x2, y: masterSegs[mi].y2},
        ]);
        const srcPts = srcRaw.map(p => new cv.Point2(p.x, p.y));
        const dstPts = dstRaw.map(p => new cv.Point2(p.x, p.y));

        const scaleGap = Math.max(matchToFullScaleX, matchToFullScaleY);
        const ransacThresh = Math.max(4.0, scaleGap * 2.5);
        const {homography, mask} = cv.findHomography(srcPts, dstPts, cv.RANSAC, ransacThresh);
        homoMat = homography;
        maskMat = mask;

        if (!homoMat || homoMat.empty) {
            logger.warn('Registration: findHomography returned empty matrix');
            return null;
        }

        const maskArr = maskMat ? (maskMat.getDataAsArray() as number[][]).flat() : [];
        const inliers = maskArr.length > 0 ? maskArr.reduce((s, v) => s + v, 0) : srcRaw.length;

        if (inliers < 8) {
            logger.warn(`Registration: RANSAC inliers too low (${inliers}, mode=${usedAngleOnlyMatching ? 'angle-only' : 'position'})`);
            return null;
        }

        const inlierMask = maskArr.length > 0 ? maskArr : srcRaw.map(() => 1);
        const simH = estimateSimilarityLeastSquares(srcRaw, dstRaw, inlierMask);
        const H = simH ?? (homoMat.getDataAsArray() as number[][]).flat();
        const transformType = simH ? 'similarity-4dof-refit' : 'homography-8dof-fallback';

        logger.debug(
            `Registration OK: ${inliers} inliers / ${srcRaw.length} point pairs (${segMatches.length} segments), ` +
            `transform=${transformType}, master ${masterW}×${masterH}, match ${masterMatch.cols}×${masterMatch.rows}`
        );
        return {H, masterW, masterH};
    } catch (err) {
        logger.warn(`Registration error: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    } finally {
        // Debug composite at *match* resolution (thumb vs downscaled master) so lines are comparable.
        if (debugDir && thumbMatch && !thumbMatch.empty && masterMatch && !masterMatch.empty) {
            let thumbDbg: Mat | null = null;
            let masterDbg: Mat | null = null;
            let thumbPadded: Mat | null = null;
            let masterPadded: Mat | null = null;
            let composite: Mat | null = null;
            try {
                fs.mkdirSync(debugDir, {recursive: true});
                const GAP = 10;
                const tW = thumbMatch.cols;
                const tH = thumbMatch.rows;
                const mW = masterMatch.cols;
                const mH = masterMatch.rows;
                const maxH = Math.max(tH, mH);

                thumbDbg = thumbMatch.channels === 1 ? thumbMatch.cvtColor(cv.COLOR_GRAY2BGR) : thumbMatch.copy();
                masterDbg = masterMatch.channels === 1 ? masterMatch.cvtColor(cv.COLOR_GRAY2BGR) : masterMatch.copy();

                const grey = new cv.Vec3(120, 120, 120);
                const green = new cv.Vec3(0, 220, 0);
                const cyan = new cv.Vec3(220, 220, 0);

                const matchedThumbIdx = new Set(segMatches.map(m => m.ti));
                const matchedMasterIdx = new Set(segMatches.map(m => m.mi));

                for (let i = 0; i < thumbSegs.length; i++) {
                    const s = thumbSegs[i];
                    thumbDbg.drawLine(new cv.Point2(s.x1, s.y1), new cv.Point2(s.x2, s.y2), matchedThumbIdx.has(i) ? green : grey, 2);
                }
                for (let i = 0; i < masterMatchSegs.length; i++) {
                    const s = masterMatchSegs[i];
                    masterDbg.drawLine(new cv.Point2(s.x1, s.y1), new cv.Point2(s.x2, s.y2), matchedMasterIdx.has(i) ? green : grey, 2);
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
                for (const {ti, mi} of segMatches) {
                    const ts = thumbSegs[ti];
                    const ms = masterMatchSegs[mi];
                    const pt1 = new cv.Point2(Math.round((ts.x1 + ts.x2) / 2), Math.round((ts.y1 + ts.y2) / 2));
                    const pt2 = new cv.Point2(Math.round((ms.x1 + ms.x2) / 2) + xOffset, Math.round((ms.y1 + ms.y2) / 2));
                    composite.drawLine(pt1, pt2, cyan, 1);
                }

                cv.imwrite(path.join(debugDir, '12-registration-matches.png'), composite);
            } catch (dbgErr) {
                logger.warn(`Failed to save registration debug image: ${dbgErr instanceof Error ? dbgErr.message : String(dbgErr)}`);
            } finally {
                safeRelease(thumbDbg, masterDbg, thumbPadded, masterPadded, composite);
            }
        }
        if (masterMatch && masterMatch !== masterGray) safeRelease(masterMatch);
        if (thumbMatch && thumbMatch !== thumbGray) safeRelease(thumbMatch);
        safeRelease(thumbGray, masterGray, homoMat, maskMat);
    }
}

/**
 * Extracts the highlighted unit polygon from a unit floor-plan thumbnail.
 *
 * When `masterPlanPath` is provided:
 *   1. Prefer line-based registration → master-space coords
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
