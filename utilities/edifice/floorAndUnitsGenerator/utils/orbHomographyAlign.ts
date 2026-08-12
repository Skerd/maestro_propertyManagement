/**
 * Batch-align unit schematics onto a floor master plan.
 *
 * For each floor, the alignment (detailed <-> schematic) is computed once per
 * distinct schematic size and reused for every unit sharing that size — this is
 * the expensive step (feature matching + homography). Grouping matters because a
 * floor's unit pages may mix paper sizes, which scales their schematics; the
 * homography is only valid at the scale it was fitted for.
 *
 * For each unit, the highlighted region is extracted as a polygon (contour +
 * approxPolyDP + perspectiveTransform on a handful of points) and composited
 * onto the detailed plan by rasterizing that polygon into a small bounding-box
 * crop — no full-image mask warp.
 *
 * Uses @techstark/opencv-js (as provided — not ported to opencv4nodejs).
 */

import cv from "@techstark/opencv-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import type {PolygonPoint} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types";

export type Point = { x: number; y: number };

/**
 * Max relative difference in schematic dimensions still considered "the same
 * framing". Crop bounds come from per-page line detection, so sibling pages of
 * identical paper size still vary by a pixel or two (999 vs 1002 px wide).
 */
const SCHEMATIC_SIZE_TOLERANCE = 0.02;

/** How far outside the master a mapped polygon may stray before it is rejected. */
const POLYGON_BOUNDS_MARGIN = 0.02;

// ---- IO helpers -----------------------------------------------------

async function loadMatRGBA(filePath: string): Promise<InstanceType<typeof cv.Mat>> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mat = new cv.Mat(info.height, info.width, cv.CV_8UC4);
  mat.data.set(data);
  return mat;
}

async function saveMatRGBA(mat: InstanceType<typeof cv.Mat>, filePath: string): Promise<void> {
  const buffer = Buffer.from(mat.data);
  await sharp(buffer, {
    raw: { width: mat.cols, height: mat.rows, channels: 4 },
  })
    .png()
    .toFile(filePath);
}

function waitForOpenCV(): Promise<void> {
  return new Promise((resolve) => {
    if ((cv as any).calledRun) return resolve();
    (cv as any).onRuntimeInitialized = () => resolve();
  });
}

// ---- Per-floor setup (expensive — run once per floor) --------------------

/** Returns H_full_inv: maps schematic-space points -> detailed-space points. */
function computeHomography(
  detailedFull: InstanceType<typeof cv.Mat>,
  schematic: InstanceType<typeof cv.Mat>
): { H_full_inv: InstanceType<typeof cv.Mat>; inliers: number } {
  const scale = schematic.cols / detailedFull.cols;
  const detailedSmall = new cv.Mat();
  cv.resize(
    detailedFull,
    detailedSmall,
    new cv.Size(Math.round(detailedFull.cols * scale), Math.round(detailedFull.rows * scale)),
    0,
    0,
    cv.INTER_AREA
  );

  const gray1 = new cv.Mat();
  const gray2 = new cv.Mat();
  cv.cvtColor(detailedSmall, gray1, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(schematic, gray2, cv.COLOR_RGBA2GRAY);

  // ORB is bundled in the standard opencv.js WASM build (unlike SIFT,
  // which some builds omit). Since this only runs once per floor, feel
  // free to bump nFeatures if matches are sparse.
  const orb = new cv.ORB(3000);
  const kp1 = new cv.KeyPointVector();
  const kp2 = new cv.KeyPointVector();
  const des1 = new cv.Mat();
  const des2 = new cv.Mat();
  orb.detectAndCompute(gray1, new cv.Mat(), kp1, des1);
  orb.detectAndCompute(gray2, new cv.Mat(), kp2, des2);

  const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const knnMatches = new cv.DMatchVectorVector();
  bf.knnMatch(des1, des2, knnMatches, 2);

  const srcPts: number[] = [];
  const dstPts: number[] = [];
  for (let i = 0; i < knnMatches.size(); i++) {
    const pair = knnMatches.get(i);
    if (pair.size() < 2) continue;
    const m = pair.get(0);
    const n = pair.get(1);
    if (m.distance < 0.75 * n.distance) {
      const p1 = kp1.get(m.queryIdx).pt;
      const p2 = kp2.get(m.trainIdx).pt;
      srcPts.push(p1.x, p1.y);
      dstPts.push(p2.x, p2.y);
    }
  }

  if (srcPts.length < 8) {
    throw new Error(`Only found ${srcPts.length / 2} good matches — too few for a reliable homography.`);
  }

  const srcMat = cv.matFromArray(srcPts.length / 2, 1, cv.CV_32FC2, srcPts);
  const dstMat = cv.matFromArray(dstPts.length / 2, 1, cv.CV_32FC2, dstPts);
  const mask = new cv.Mat();
  const H_small = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5, mask);

  let inliers = 0;
  for (let i = 0; i < mask.rows; i++) if (mask.data[i]) inliers++;

  const S = cv.matFromArray(3, 3, cv.CV_64F, [scale, 0, 0, 0, scale, 0, 0, 0, 1]);
  const H_full = new cv.Mat();
  cv.gemm(H_small, S, 1, new cv.Mat(), 0, H_full);

  const H_full_inv = new cv.Mat();
  cv.invert(H_full, H_full_inv);

  [detailedSmall, gray1, gray2, des1, des2, srcMat, dstMat, mask, H_small, S, H_full].forEach((m) =>
    m.delete()
  );

  return { H_full_inv, inliers };
}

// ---- Per-unit work (cheap — run once per unit) ----------------------------

function isolateTealMask(schematic: InstanceType<typeof cv.Mat>): InstanceType<typeof cv.Mat> {
  const mask = new cv.Mat(schematic.rows, schematic.cols, cv.CV_8UC1);
  for (let y = 0; y < schematic.rows; y++) {
    for (let x = 0; x < schematic.cols; x++) {
      const idx = (y * schematic.cols + x) * 4;
      const r = schematic.data[idx];
      const g = schematic.data[idx + 1];
      const b = schematic.data[idx + 2];
      const isTeal = g - r > 15 && b - r > 15 && r < 160;
      mask.data[y * schematic.cols + x] = isTeal ? 255 : 0;
    }
  }
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, cv.Mat.ones(3, 3, cv.CV_8U));
  cv.morphologyEx(mask, mask, cv.MORPH_OPEN, cv.Mat.ones(3, 3, cv.CV_8U));
  return mask;
}

/**
 * Finds the highlighted region in `mask` (schematic pixel space), simplifies
 * it into a clean polygon, and maps each vertex into the detailed image's
 * pixel space via `H_full_inv`. Uses cv.perspectiveTransform on the (few)
 * polygon vertices rather than warping the full raster mask.
 */
function extractPolygon(
  mask: InstanceType<typeof cv.Mat>,
  H_full_inv: InstanceType<typeof cv.Mat>,
  epsilonFraction = 0.005
): Point[] {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  if (contours.size() === 0) {
    contours.delete();
    hierarchy.delete();
    throw new Error("No highlighted region found in the schematic mask.");
  }

  let largestIdx = 0;
  let largestArea = -Infinity;
  for (let i = 0; i < contours.size(); i++) {
    const area = cv.contourArea(contours.get(i));
    if (area > largestArea) {
      largestArea = area;
      largestIdx = i;
    }
  }
  const largest = contours.get(largestIdx);

  const epsilon = epsilonFraction * cv.arcLength(largest, true);
  const approx = new cv.Mat();
  cv.approxPolyDP(largest, approx, epsilon, true);

  const n = approx.rows;
  // approx is N×1 CV_32SC2 — prefer data32S (reliable in @techstark/opencv-js)
  const flat: number[] = [];
  for (let i = 0; i < n; i++) {
    flat.push(approx.data32S[i * 2], approx.data32S[i * 2 + 1]);
  }
  const srcPts = cv.matFromArray(n, 1, cv.CV_32FC2, flat);
  const dstPts = new cv.Mat();
  cv.perspectiveTransform(srcPts, dstPts, H_full_inv);

  const polygon: Point[] = [];
  for (let i = 0; i < n; i++) {
    polygon.push({
      x: dstPts.data32F[i * 2],
      y: dstPts.data32F[i * 2 + 1],
    });
  }

  [contours, hierarchy, approx, srcPts, dstPts].forEach((m) => m.delete());
  return polygon;
}

/**
 * Rasterizes `polygon` directly into a small bounding-box crop of `detailed`
 * and blends it there — no full-image mask warp.
 */
function compositePolygonHighlight(
  detailed: InstanceType<typeof cv.Mat>,
  polygon: Point[],
  colorRGBA: [number, number, number, number] = [77, 131, 134, 255],
  alpha = 0.45,
  pad = 5
): InstanceType<typeof cv.Mat> {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const x0 = Math.max(Math.floor(Math.min(...xs)) - pad, 0);
  const y0 = Math.max(Math.floor(Math.min(...ys)) - pad, 0);
  const x1 = Math.min(Math.ceil(Math.max(...xs)) + pad, detailed.cols);
  const y1 = Math.min(Math.ceil(Math.max(...ys)) + pad, detailed.rows);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);

  const localPtsFlat: number[] = [];
  for (const p of polygon) localPtsFlat.push(Math.round(p.x - x0), Math.round(p.y - y0));
  const localPtsMat = cv.matFromArray(polygon.length, 1, cv.CV_32SC2, localPtsFlat);
  const ptsVec = new cv.MatVector();
  ptsVec.push_back(localPtsMat);

  const smallMask = cv.Mat.zeros(h, w, cv.CV_8UC1);
  cv.fillPoly(smallMask, ptsVec, new cv.Scalar(255));
  cv.GaussianBlur(smallMask, smallMask, new cv.Size(7, 7), 0);

  const result = detailed.clone();
  const rect = new cv.Rect(x0, y0, w, h);
  // .roi() returns a Mat header sharing the same underlying buffer as
  // `result`, so writing into roi.data updates `result` in place.
  const roi = result.roi(rect);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (smallMask.data[y * w + x] / 255) * alpha;
      if (a <= 0) continue;
      const pIdx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        roi.data[pIdx + c] = roi.data[pIdx + c] * (1 - a) + colorRGBA[c] * a;
      }
    }
  }

  [localPtsMat, ptsVec, smallMask, roi].forEach((m) => m.delete());
  return result;
}

function toFractional(polygon: Point[], width: number, height: number): PolygonPoint[] {
  return polygon.map((p) => ({
    x: Math.min(1, Math.max(0, p.x / width)),
    y: Math.min(1, Math.max(0, p.y / height)),
  }));
}

function polygonAreaPx(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * The homography bakes in the reference schematic's scale
 * (`scale = schematic.cols / detailedFull.cols`), so it is only valid for
 * schematics framed like the one it was fitted against. Feeding it a thumbnail
 * cropped from a differently-sized PDF page silently lands the polygon far from
 * the real unit, so refuse rather than emit a plausible-looking wrong answer.
 */
function assertSchematicMatchesSession(
  schematic: InstanceType<typeof cv.Mat>,
  session: FloorAlignSession,
  schematicPath: string
): void {
  const dw = Math.abs(schematic.cols - session.schematicWidth) / session.schematicWidth;
  const dh = Math.abs(schematic.rows - session.schematicHeight) / session.schematicHeight;
  if (dw > SCHEMATIC_SIZE_TOLERANCE || dh > SCHEMATIC_SIZE_TOLERANCE) {
    throw new Error(
      `Schematic ${path.basename(schematicPath)} is ${schematic.cols}x${schematic.rows}, but the ` +
      `homography was fitted on ${session.schematicWidth}x${session.schematicHeight}. ` +
      `Align it with a session built from a same-sized schematic.`
    );
  }
}

/**
 * Backstop for a homography gone wild (a degenerate RANSAC fit, say) that the
 * size check cannot see: a polygon landing off the master is unambiguously
 * wrong, whatever its shape. Deliberately geometric — unit sizes vary far too
 * much between buildings to threshold on area.
 */
function assertPlausiblePolygon(polygon: Point[], masterWidth: number, masterHeight: number): void {
  if (polygon.length < 3) {
    throw new Error(`Highlight polygon has only ${polygon.length} vertices.`);
  }

  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const marginX = masterWidth * POLYGON_BOUNDS_MARGIN;
  const marginY = masterHeight * POLYGON_BOUNDS_MARGIN;
  if (
    Math.min(...xs) < -marginX ||
    Math.min(...ys) < -marginY ||
    Math.max(...xs) > masterWidth + marginX ||
    Math.max(...ys) > masterHeight + marginY
  ) {
    throw new Error(
      `Highlight polygon falls outside the master plan ` +
      `(x ${Math.round(Math.min(...xs))}..${Math.round(Math.max(...xs))}, ` +
      `y ${Math.round(Math.min(...ys))}..${Math.round(Math.max(...ys))} vs ${masterWidth}x${masterHeight}).`
    );
  }
}

// ---- Public API -----------------------------------------------------------

export type FloorAlignSession = {
  inliers: number;
  width: number;
  height: number;
  /**
   * Size of the schematic the homography was fitted against. Only schematics
   * of this size (within {@link SCHEMATIC_SIZE_TOLERANCE}) may be aligned with
   * this session — see {@link groupBySchematicSize}.
   */
  schematicWidth: number;
  schematicHeight: number;
  /** Release OpenCV mats held by this session. */
  dispose: () => void;
};

type FloorAlignInternal = FloorAlignSession & {
  detailed: InstanceType<typeof cv.Mat>;
  H_full_inv: InstanceType<typeof cv.Mat>;
};

/**
 * Load master + compute homography from a reference unit schematic.
 * Call once per {@link groupBySchematicSize} group, then
 * {@link alignUnitHighlight} for each unit in that group.
 */
export async function beginFloorAlign(
  detailedPath: string,
  firstSchematicPath: string
): Promise<FloorAlignSession> {
  await waitForOpenCV();

  const detailed = await loadMatRGBA(detailedPath);
  const firstSchematic = await loadMatRGBA(firstSchematicPath);
  const schematicWidth = firstSchematic.cols;
  const schematicHeight = firstSchematic.rows;
  let H_full_inv: InstanceType<typeof cv.Mat>;
  let inliers: number;
  try {
    ({ H_full_inv, inliers } = computeHomography(detailed, firstSchematic));
  } catch (error) {
    detailed.delete();
    throw error;
  } finally {
    firstSchematic.delete();
  }

  const session: FloorAlignInternal = {
    inliers,
    width: detailed.cols,
    height: detailed.rows,
    schematicWidth,
    schematicHeight,
    detailed,
    H_full_inv,
    dispose: () => {
      detailed.delete();
      H_full_inv.delete();
    },
  };
  return session;
}

/**
 * Bucket unit jobs by the pixel size of their schematic thumbnail.
 *
 * A floor's unit pages are not guaranteed to share a paper size — Dyeus_Album
 * mixes A4 and A3 within one floor — and the thumbnail scales with the page, so
 * one homography cannot serve all of them. Build a session per bucket.
 */
export async function groupBySchematicSize<T>(
  jobs: T[],
  getSchematicPath: (job: T) => string,
  tolerance: number = SCHEMATIC_SIZE_TOLERANCE
): Promise<Array<{ width: number; height: number; jobs: T[] }>> {
  const groups: Array<{ width: number; height: number; jobs: T[] }> = [];

  for (const job of jobs) {
    let width = 0;
    let height = 0;
    try {
      const meta = await sharp(getSchematicPath(job)).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
    } catch {
      // Unreadable schematic: give it its own bucket so it fails in isolation
      // rather than poisoning a good group's reference.
    }

    const match = groups.find(
      (g) =>
        width > 0 &&
        Math.abs(g.width - width) / g.width <= tolerance &&
        Math.abs(g.height - height) / g.height <= tolerance
    );
    if (match) {
      match.jobs.push(job);
    } else {
      groups.push({ width, height, jobs: [job] });
    }
  }

  return groups;
}

export type AlignUnitResult = {
  /** Largest highlight outline in fractional master coords. */
  polygons: PolygonPoint[];
  allPolygons: PolygonPoint[][];
  allPolygonAreas: number[];
  /** Pixel-space polygon on the master image. */
  pixelPolygon: Point[];
};

/**
 * Extract teal highlight polygon from a unit schematic, map onto the floor
 * master via the shared homography, composite highlight, and write PNG.
 */
export async function alignUnitHighlight(
  session: FloorAlignSession,
  schematicPath: string,
  outputPath: string,
  opts: {
    alpha?: number;
    highlightColorRGBA?: [number, number, number, number];
    polygonJsonPath?: string;
  } = {}
): Promise<AlignUnitResult> {
  const internal = session as FloorAlignInternal;
  const alpha = opts.alpha ?? 0.45;
  const color = opts.highlightColorRGBA ?? ([77, 131, 134, 255] as [number, number, number, number]);

  const schematic = await loadMatRGBA(schematicPath);
  let mask: InstanceType<typeof cv.Mat> | undefined;
  let result: InstanceType<typeof cv.Mat> | undefined;
  let pixelPolygon: Point[];

  try {
    assertSchematicMatchesSession(schematic, session, schematicPath);
    mask = isolateTealMask(schematic);
    pixelPolygon = extractPolygon(mask, internal.H_full_inv);
    // Validate before compositing so a bad mapping never reaches disk.
    assertPlausiblePolygon(pixelPolygon, session.width, session.height);
    result = compositePolygonHighlight(internal.detailed, pixelPolygon, color, alpha);

    await saveMatRGBA(result, outputPath);

    if (opts.polygonJsonPath) {
      fs.writeFileSync(
        opts.polygonJsonPath,
        JSON.stringify({ points: pixelPolygon }, null, 2)
      );
    }
  } finally {
    [schematic, mask, result].forEach((m) => m?.delete());
  }

  const fractional = toFractional(pixelPolygon, session.width, session.height);
  const area = polygonAreaPx(pixelPolygon);

  return {
    polygons: fractional,
    allPolygons: fractional.length >= 3 ? [fractional] : [],
    allPolygonAreas: fractional.length >= 3 ? [area] : [],
    pixelPolygon,
  };
}

/**
 * Standalone batch helper matching the floors / floor-* / units / * directory layout.
 * Optional — the PDF pipeline uses {@link beginFloorAlign} + {@link alignUnitHighlight}.
 */
export async function processFloorsRoot(floorsRoot: string, outRoot: string): Promise<void> {
  await waitForOpenCV();
  fs.mkdirSync(outRoot, { recursive: true });

  const floorDirs = fs
    .readdirSync(floorsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(floorsRoot, d.name))
    .sort();

  for (const floorDir of floorDirs) {
    const detailedPath = path.join(floorDir, "floor-plan.png");
    const unitsDir = path.join(floorDir, "units");
    if (!fs.existsSync(detailedPath) || !fs.existsSync(unitsDir)) continue;

    const unitNames = fs
      .readdirSync(unitsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => fs.existsSync(path.join(unitsDir, name, "floor-plan.png")))
      .sort();
    if (unitNames.length === 0) continue;

    const floorName = path.basename(floorDir);
    const outDir = path.join(outRoot, floorName);
    fs.mkdirSync(outDir, { recursive: true });

    const groups = await groupBySchematicSize(unitNames, (unitName) =>
      path.join(unitsDir, unitName, "floor-plan.png")
    );

    for (const group of groups) {
      const session = await beginFloorAlign(
        detailedPath,
        path.join(unitsDir, group.jobs[0], "floor-plan.png")
      );
      try {
        for (const unitName of group.jobs) {
          await alignUnitHighlight(
            session,
            path.join(unitsDir, unitName, "floor-plan.png"),
            path.join(outDir, `${unitName}.png`),
            { polygonJsonPath: path.join(outDir, `${unitName}.polygon.json`) }
          );
        }
      } finally {
        session.dispose();
      }
    }
  }
}
