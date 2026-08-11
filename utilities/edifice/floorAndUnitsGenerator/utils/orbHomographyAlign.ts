/**
 * Align two raster floor plans (e.g. a detailed plan and a simplified
 * schematic of the same floor) using shared grid-line features, then
 * project a highlighted region from the schematic onto the detailed plan
 * and extract that region's polygon in master-image coordinates.
 *
 * Uses @techstark/opencv-js (as provided — not ported to opencv4nodejs).
 */

import cv from "@techstark/opencv-js";
import sharp from "sharp";
import type {PolygonPoint} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/types";

// ---- IO helpers -----------------------------------------------------

async function loadMatRGBA(path: string): Promise<InstanceType<typeof cv.Mat>> {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mat = new cv.Mat(info.height, info.width, cv.CV_8UC4);
  mat.data.set(data);
  return mat;
}

async function saveMatRGBA(
  mat: InstanceType<typeof cv.Mat>,
  path: string
): Promise<void> {
  const buffer = Buffer.from(mat.data);
  await sharp(buffer, {
    raw: { width: mat.cols, height: mat.rows, channels: 4 },
  })
    .png()
    .toFile(path);
}

function waitForOpenCV(): Promise<void> {
  return new Promise((resolve) => {
    if ((cv as any).calledRun) return resolve();
    (cv as any).onRuntimeInitialized = () => resolve();
  });
}

// ---- Core alignment ---------------------------------------------------

/**
 * Finds a homography mapping points in `detailedFull` -> points in
 * `schematic`, by matching features on a downscaled copy of `detailed`
 * (so both images are compared at similar resolution).
 */
function computeHomography(
  detailedFull: InstanceType<typeof cv.Mat>,
  schematic: InstanceType<typeof cv.Mat>
): { H_full: InstanceType<typeof cv.Mat>; inliers: number } {
  const scale = schematic.cols / detailedFull.cols;
  const detailedSmall = new cv.Mat();
  cv.resize(
    detailedFull,
    detailedSmall,
    new cv.Size(
      Math.round(detailedFull.cols * scale),
      Math.round(detailedFull.rows * scale)
    ),
    0,
    0,
    cv.INTER_AREA
  );

  const gray1 = new cv.Mat();
  const gray2 = new cv.Mat();
  cv.cvtColor(detailedSmall, gray1, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(schematic, gray2, cv.COLOR_RGBA2GRAY);

  // ORB is bundled in the standard opencv.js WASM build (unlike SIFT,
  // which some builds omit). 3000 features gives enough density for a
  // line-drawing like a floor plan.
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
    throw new Error(
      `Only found ${srcPts.length / 2} good matches — too few for a reliable homography.`
    );
  }

  const srcMat = cv.matFromArray(srcPts.length / 2, 1, cv.CV_32FC2, srcPts);
  const dstMat = cv.matFromArray(dstPts.length / 2, 1, cv.CV_32FC2, dstPts);
  const mask = new cv.Mat();
  const H_small = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5, mask);

  let inliers = 0;
  for (let i = 0; i < mask.rows; i++) if (mask.data[i]) inliers++;

  // H_small maps detailedSmall -> schematic. Compose with the scale
  // matrix to get H_full: detailedFull -> schematic.
  const S = cv.matFromArray(3, 3, cv.CV_64F, [scale, 0, 0, 0, scale, 0, 0, 0, 1]);
  const H_full = new cv.Mat();
  cv.gemm(H_small, S, 1, new cv.Mat(), 0, H_full);

  [detailedSmall, gray1, gray2, des1, des2, srcMat, dstMat, mask, H_small, S].forEach(
    (m) => m.delete()
  );

  return { H_full, inliers };
}

/**
 * Contour the warped teal mask → polygons in fractional master coordinates.
 * Returns largest region first; drops tiny noise blobs.
 */
function polygonsFromWarpedMask(
  maskWarped: InstanceType<typeof cv.Mat>,
  width: number,
  height: number
): { polygons: PolygonPoint[][]; areasPxSq: number[] } {
  const binary = new cv.Mat();
  cv.threshold(maskWarped, binary, 127, 255, cv.THRESH_BINARY);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    binary,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  const minArea = Math.max(64, (width * height) * 0.00005);
  const scored: Array<{ points: PolygonPoint[]; area: number }> = [];

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    if (area < minArea) continue;

    const peri = cv.arcLength(contour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, Math.max(2, 0.005 * peri), true);

    const points: PolygonPoint[] = [];
    // approx is N×1 CV_32SC2 → data32S [x0,y0,x1,y1,...]
    const n = approx.rows;
    for (let j = 0; j < n; j++) {
      const x = approx.data32S[j * 2];
      const y = approx.data32S[j * 2 + 1];
      points.push({
        x: Math.min(1, Math.max(0, x / width)),
        y: Math.min(1, Math.max(0, y / height)),
      });
    }
    approx.delete();

    if (points.length >= 3) {
      scored.push({ points, area });
    }
  }

  contours.delete();
  hierarchy.delete();
  binary.delete();

  scored.sort((a, b) => b.area - a.area);
  return {
    polygons: scored.map((s) => s.points),
    areasPxSq: scored.map((s) => s.area),
  };
}

// ---- Main pipeline ------------------------------------------------------

export type AlignAndHighlightResult = {
  inliers: number;
  /** Highlight outline(s) in fractional coords of the detailed (master) image. Largest first. */
  polygons: PolygonPoint[];
  /** All highlight regions (largest first), fractional master coords. */
  allPolygons: PolygonPoint[][];
  allPolygonAreas: number[];
  width: number;
  height: number;
};

export async function alignAndHighlight(
  detailedPath: string,
  schematicPath: string,
  outputPath: string,
  opts: { alpha?: number; highlightColorRGBA?: [number, number, number, number] } = {}
): Promise<AlignAndHighlightResult> {
  await waitForOpenCV();

  const alpha = opts.alpha ?? 0.45;
  const highlight = opts.highlightColorRGBA ?? [77, 131, 134, 255]; // RGBA teal

  const detailed = await loadMatRGBA(detailedPath);
  const schematic = await loadMatRGBA(schematicPath);

  const { H_full, inliers } = computeHomography(detailed, schematic);

  const H_full_inv = new cv.Mat();
  cv.invert(H_full, H_full_inv);

  // --- Isolate the teal highlight in the schematic ---
  // Same color-difference heuristic as the Python version: teal pixels
  // have G and B well above R.
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

  // --- Warp the mask into the detailed image's coordinate space ---
  const maskWarped = new cv.Mat();
  cv.warpPerspective(
    mask,
    maskWarped,
    H_full_inv,
    new cv.Size(detailed.cols, detailed.rows),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(0)
  );
  cv.GaussianBlur(maskWarped, maskWarped, new cv.Size(9, 9), 0);

  const { polygons: allPolygons, areasPxSq: allPolygonAreas } = polygonsFromWarpedMask(
    maskWarped,
    detailed.cols,
    detailed.rows
  );

  // --- Also warp full schematic onto detailed for overlap QA ---
  const schematicWarped = new cv.Mat();
  cv.warpPerspective(
    schematic,
    schematicWarped,
    H_full_inv,
    new cv.Size(detailed.cols, detailed.rows),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(255, 255, 255, 255)
  );

  // --- Composite the highlight onto the detailed plan ---
  const result = detailed.clone();
  for (let y = 0; y < result.rows; y++) {
    for (let x = 0; x < result.cols; x++) {
      const mIdx = y * result.cols + x;
      const a = (maskWarped.data[mIdx] / 255) * alpha;
      if (a <= 0) continue;
      const pIdx = mIdx * 4;
      for (let c = 0; c < 3; c++) {
        result.data[pIdx + c] =
          result.data[pIdx + c] * (1 - a) + highlight[c] * a;
      }
    }
  }

  await saveMatRGBA(result, outputPath);

  // 50/50 overlay next to the highlight output when possible.
  const overlayPath = outputPath.replace(/\.png$/i, "-overlay.png");
  const overlay = detailed.clone();
  for (let y = 0; y < overlay.rows; y++) {
    for (let x = 0; x < overlay.cols; x++) {
      const pIdx = (y * overlay.cols + x) * 4;
      for (let c = 0; c < 3; c++) {
        overlay.data[pIdx + c] =
          overlay.data[pIdx + c] * 0.5 + schematicWarped.data[pIdx + c] * 0.5;
      }
    }
  }
  await saveMatRGBA(overlay, overlayPath);

  const width = detailed.cols;
  const height = detailed.rows;

  [detailed, schematic, H_full, H_full_inv, mask, maskWarped, schematicWarped, result, overlay].forEach((m) =>
    m.delete()
  );

  return {
    inliers,
    polygons: allPolygons[0] ?? [],
    allPolygons,
    allPolygonAreas,
    width,
    height,
  };
}
