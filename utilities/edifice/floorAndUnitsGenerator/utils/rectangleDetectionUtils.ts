import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from '../config';
import type {HorizontalSegment, Rectangle, VerticalSegment} from '../types';

/**
 * Checks if rectangle A contains rectangle B
 */
function contains(outer: Rectangle, inner: Rectangle, tolerance: number = config.RECT_DEDUP_TOLERANCE): boolean {
    // Check if outer contains inner (with tolerance for boundary matching)
    const containsLeft = outer.left <= inner.left + tolerance;
    const containsRight = outer.right >= inner.right - tolerance;
    const containsTop = outer.top <= inner.top + tolerance;
    const containsBottom = outer.bottom >= inner.bottom - tolerance;

    // All boundaries must be contained
    if (!(containsLeft && containsRight && containsTop && containsBottom)) {
        return false;
    }

    // Check if they're not the same rectangle (within tolerance)
    const sameLeft = Math.abs(outer.left - inner.left) <= tolerance;
    const sameRight = Math.abs(outer.right - inner.right) <= tolerance;
    const sameTop = Math.abs(outer.top - inner.top) <= tolerance;
    const sameBottom = Math.abs(outer.bottom - inner.bottom) <= tolerance;

    // If all boundaries are the same, they're duplicates, not containment
    if (sameLeft && sameRight && sameTop && sameBottom) {
        return false;
    }

    return true;
}

/**
 * A nested rectangle is only a redundant re-tracing of its container when it fills
 * almost all of it — a panel drawn with a double border, where the two outlines sit
 * a few pixels apart. Anything appreciably smaller is a real sub-panel.
 */
const REDUNDANT_NESTED_AREA_RATIO = 0.9;

/**
 * Removes rectangles that merely re-trace a larger one, e.g. the inner line of a
 * double-stroked panel border.
 *
 * Genuine sub-panels are kept. Some brochures draw a frame around a whole column and
 * divide it into stacked panels (GARDA_TOWER wraps the position thumbnail, the
 * elevation/render row and the areas table in one border); dropping every nested
 * rectangle collapsed that column to a single box, which both handed ORB a composite
 * image instead of the floor thumbnail and pulled the areas table into the
 * text-exclusion zone, zeroing the unit's SIPERFAQE values.
 */
function removeContainedRectangles(rectangles: Rectangle[]): Rectangle[] {
    if (rectangles.length === 0) {
        return [];
    }

    const area = (rect: Rectangle): number => Math.max(1, rect.width * rect.height);

    return rectangles.filter((rect) => {
        const isRedundantCopyOfOther = rectangles.some((other) => {
            if (rect === other) {
                return false;
            }
            return contains(other, rect) && area(rect) / area(other) >= REDUNDANT_NESTED_AREA_RATIO;
        });
        return !isRedundantCopyOfOther;
    });
}

/**
 * Removes duplicate rectangles
 */
function dedupeRectangles(rectangles: Rectangle[]): Rectangle[] {
    const deduped: Rectangle[] = [];
    for (const rect of rectangles) {
        const exists = deduped.some(
            (existing) =>
                Math.abs(existing.left - rect.left) <= config.RECT_DEDUP_TOLERANCE &&
                Math.abs(existing.right - rect.right) <= config.RECT_DEDUP_TOLERANCE &&
                Math.abs(existing.top - rect.top) <= config.RECT_DEDUP_TOLERANCE &&
                Math.abs(existing.bottom - rect.bottom) <= config.RECT_DEDUP_TOLERANCE
        );
        if (!exists) {
            deduped.push(rect);
        }
    }
    return deduped;
}

/**
 * Checks if a vertical line intersects with a horizontal range
 */
function verticalIntersectsHorizontal(vLine: VerticalSegment, hY: number, tolerance: number = config.LINE_SNAP_TOLERANCE): boolean {
    return Math.abs(vLine.yStart - hY) <= tolerance || Math.abs(vLine.yEnd - hY) <= tolerance || (vLine.yStart <= hY && vLine.yEnd >= hY);
}

/**
 * Checks if a horizontal line intersects with a vertical range
 */
function horizontalIntersectsVertical(hLine: HorizontalSegment, vX: number, tolerance: number = config.LINE_SNAP_TOLERANCE): boolean {
    return Math.abs(hLine.xStart - vX) <= tolerance || Math.abs(hLine.xEnd - vX) <= tolerance || (hLine.xStart <= vX && hLine.xEnd >= vX);
}

/**
 * Gets rectangle key for deduplication
 */
function getRectKey(left: number, right: number, top: number, bottom: number): string {
    return `${Math.round(left / config.RECT_DEDUP_TOLERANCE)}_${Math.round(right / config.RECT_DEDUP_TOLERANCE)}_${Math.round(top / config.RECT_DEDUP_TOLERANCE)}_${Math.round(bottom / config.RECT_DEDUP_TOLERANCE)}`;
}

/**
 * Finds rectangles from horizontal and vertical line segments
 */
export function findRectanglesFromLines(horizontals: HorizontalSegment[], verticals: VerticalSegment[], width: number, height: number, timer: PerformanceTimer): Rectangle[] {
    return timer.timeSync('findRectanglesFromLines', () => {

        const minWidth = Math.round(width * config.RECT_MIN_WIDTH_RATIO);
        const minHeight = Math.round(height * config.RECT_MIN_HEIGHT_RATIO);
        const maxWidth = Math.round(width * config.RECT_MAX_WIDTH_RATIO);
        const maxHeight = Math.round(height * config.RECT_MAX_HEIGHT_RATIO);

        const filteredHorizontals = horizontals.filter((line) => line.xEnd - line.xStart + 1 >= minWidth);
        const filteredVerticals = verticals.filter((line) => line.yEnd - line.yStart + 1 >= minHeight);

        const rectangles: Rectangle[] = [];
        const rectangleSet = new Set<string>(); // For deduplication during construction

        // Helper to add rectangle if valid and not duplicate, using exact line positions
        const addRectangle = (left: number, right: number, top: number, bottom: number): void => {
            // Use exact positions as-is for pixel-perfect alignment (no rounding)
            const finalLeft = Math.min(left, right);
            const finalRight = Math.max(left, right);
            const finalTop = Math.min(top, bottom);
            const finalBottom = Math.max(top, bottom);

            const rectWidth = finalRight - finalLeft;
            const rectHeight = finalBottom - finalTop;

            if (rectWidth < minWidth || rectWidth > maxWidth || rectHeight < minHeight || rectHeight > maxHeight) {
                return;
            }

            const key = getRectKey(finalLeft, finalRight, finalTop, finalBottom);
            if (rectangleSet.has(key)) {
                return;
            }

            rectangleSet.add(key);
            rectangles.push({
                left: finalLeft,
                right: finalRight,
                top: finalTop,
                bottom: finalBottom,
                width: rectWidth,
                height: rectHeight,
                centerX: (finalLeft + finalRight) / 2,
                centerY: (finalTop + finalBottom) / 2
            });
        };

        // OPTIMIZATION: Pre-compute tolerance values to avoid repeated multiplication
        const doubleTolerance = config.LINE_SNAP_TOLERANCE * 2;
        
        // Method 1: Find rectangles from all horizontal line pairs
        for (let i = 0; i < filteredHorizontals.length; i += 1) {
            const topLine = filteredHorizontals[i];
            for (let j = i + 1; j < filteredHorizontals.length; j += 1) {
                const bottomLine = filteredHorizontals[j];
                const rectHeight = bottomLine.y - topLine.y;
                
                // OPTIMIZATION: Early exit if height doesn't meet requirements
                if (rectHeight < minHeight || rectHeight > maxHeight) {
                    continue;
                }

                // OPTIMIZATION: Pre-compute range values for candidate filtering
                const topY = topLine.y;
                const bottomY = bottomLine.y;
                const topYMin = topY - config.LINE_SNAP_TOLERANCE;
                const bottomYMax = bottomY + config.LINE_SNAP_TOLERANCE;

                // Find all vertical lines that could form left/right boundaries
                // OPTIMIZATION: Use for loop instead of filter for better performance
                const candidateVerticals: VerticalSegment[] = [];
                for (const vLine of filteredVerticals) {
                    // Early exits for faster filtering
                    const topIntersect = verticalIntersectsHorizontal(vLine, topY, doubleTolerance);
                    const bottomIntersect = verticalIntersectsHorizontal(vLine, bottomY, doubleTolerance);
                    const spansRange = vLine.yStart <= topY && vLine.yEnd >= bottomY;
                    const withinRange = vLine.yStart >= topYMin && vLine.yEnd <= bottomYMax;
                    
                    if (topIntersect || bottomIntersect || spansRange || withinRange) {
                        // Check horizontal intersection
                        const topHIntersect = horizontalIntersectsVertical(topLine, vLine.x, doubleTolerance);
                        const bottomHIntersect = horizontalIntersectsVertical(bottomLine, vLine.x, doubleTolerance);
                        if (topHIntersect || bottomHIntersect) {
                            candidateVerticals.push(vLine);
                        }
                    }
                }

                // Try all pairs of vertical lines as left/right boundaries
                for (let k = 0; k < candidateVerticals.length; k += 1) {
                    for (let l = k + 1; l < candidateVerticals.length; l += 1) {
                        const vLine1 = candidateVerticals[k];
                        const vLine2 = candidateVerticals[l];

                        // Determine which is actually left and which is right
                        const actualLeftLine = vLine1.x < vLine2.x ? vLine1 : vLine2;
                        const actualRightLine = vLine1.x < vLine2.x ? vLine2 : vLine1;

                        const rectWidth = Math.abs(actualRightLine.x - actualLeftLine.x);

                        if (rectWidth < minWidth || rectWidth > maxWidth) {
                            continue;
                        }

                        // OPTIMIZATION: Pre-compute tolerance values
                        const leftX = actualLeftLine.x;
                        const rightX = actualRightLine.x;
                        const leftXMin = leftX + config.LINE_SNAP_TOLERANCE;
                        const rightXMax = rightX - config.LINE_SNAP_TOLERANCE;
                        const topYMax = topY + config.LINE_SNAP_TOLERANCE;
                        const bottomYMin = bottomY - config.LINE_SNAP_TOLERANCE;

                        // Verify top line actually spans the full width (strict check)
                        const topSpans = topLine.xStart <= leftXMin && topLine.xEnd >= rightXMax;
                        // Verify bottom line actually spans the full width (strict check)
                        const bottomSpans = bottomLine.xStart <= leftXMin && bottomLine.xEnd >= rightXMax;
                        // Verify left vertical line spans the full height
                        const leftSpans = actualLeftLine.yStart <= topYMax && actualLeftLine.yEnd >= bottomYMin;
                        // Verify right vertical line spans the full height
                        const rightSpans = actualRightLine.yStart <= topYMax && actualRightLine.yEnd >= bottomYMin;

                        // All four sides must exist and span their boundaries
                        if (topSpans && bottomSpans && leftSpans && rightSpans) {
                            // Use exact line positions for precise alignment
                            const exactLeft = actualLeftLine.x;
                            const exactRight = actualRightLine.x;
                            const exactTop = topLine.y;
                            const exactBottom = bottomLine.y;
                            addRectangle(exactLeft, exactRight, exactTop, exactBottom);
                        }
                    }
                }
            }
        }

        // Method 2: Find rectangles from all vertical line pairs
        for (let i = 0; i < filteredVerticals.length; i += 1) {
            const vLine1 = filteredVerticals[i];
            for (let j = i + 1; j < filteredVerticals.length; j += 1) {
                const vLine2 = filteredVerticals[j];

                // Determine which is actually left and which is right
                const actualLeftLine = vLine1.x < vLine2.x ? vLine1 : vLine2;
                const actualRightLine = vLine1.x < vLine2.x ? vLine2 : vLine1;

                const rectWidth = Math.abs(actualRightLine.x - actualLeftLine.x);
                if (rectWidth < minWidth || rectWidth > maxWidth) {
                    continue;
                }

                // OPTIMIZATION: Pre-compute values for candidate filtering
                const leftX = actualLeftLine.x;
                const rightX = actualRightLine.x;
                const leftXMin = leftX + config.LINE_SNAP_TOLERANCE;
                const rightXMax = rightX - config.LINE_SNAP_TOLERANCE;

                // Find all horizontal lines that could form top/bottom boundaries
                // OPTIMIZATION: Use for loop instead of filter for better performance
                const candidateHorizontals: HorizontalSegment[] = [];
                for (const hLine of filteredHorizontals) {
                    const leftIntersect = horizontalIntersectsVertical(hLine, leftX, doubleTolerance);
                    const rightIntersect = horizontalIntersectsVertical(hLine, rightX, doubleTolerance);
                    const spansWidth = hLine.xStart <= leftXMin && hLine.xEnd >= rightXMax;
                    if (leftIntersect || rightIntersect || spansWidth) {
                        candidateHorizontals.push(hLine);
                    }
                }

                // Try all pairs of horizontal lines as top/bottom boundaries
                for (let k = 0; k < candidateHorizontals.length; k += 1) {
                    for (let l = k + 1; l < candidateHorizontals.length; l += 1) {
                        const hLine1 = candidateHorizontals[k];
                        const hLine2 = candidateHorizontals[l];

                        // Determine which is actually top and which is bottom
                        const actualTopLine = hLine1.y < hLine2.y ? hLine1 : hLine2;
                        const actualBottomLine = hLine1.y < hLine2.y ? hLine2 : hLine1;

                        const rectHeight = Math.abs(actualBottomLine.y - actualTopLine.y);

                        if (rectHeight < minHeight || rectHeight > maxHeight) {
                            continue;
                        }

                        const topY = actualTopLine.y;
                        const bottomY = actualBottomLine.y;
                        
                        // OPTIMIZATION: Pre-compute tolerance values
                        const topYMax = topY + config.LINE_SNAP_TOLERANCE;
                        const bottomYMin = bottomY - config.LINE_SNAP_TOLERANCE;
                        const leftXMin = leftX + config.LINE_SNAP_TOLERANCE;
                        const rightXMax = rightX - config.LINE_SNAP_TOLERANCE;

                        // Verify left line spans the height
                        const leftSpans = actualLeftLine.yStart <= topYMax && actualLeftLine.yEnd >= bottomYMin;
                        // Verify right line spans the height
                        const rightSpans = actualRightLine.yStart <= topYMax && actualRightLine.yEnd >= bottomYMin;
                        // Verify top line spans the width
                        const topSpans = actualTopLine.xStart <= leftXMin && actualTopLine.xEnd >= rightXMax;
                        // Verify bottom line spans the width
                        const bottomSpans = actualBottomLine.xStart <= leftXMin && actualBottomLine.xEnd >= rightXMax;

                        // All four sides must exist and span their boundaries
                        if (leftSpans && rightSpans && topSpans && bottomSpans) {
                            // Use exact line positions for precise alignment
                            const exactLeft = actualLeftLine.x;
                            const exactRight = actualRightLine.x;
                            const exactTop = actualTopLine.y;
                            const exactBottom = actualBottomLine.y;
                            addRectangle(exactLeft, exactRight, exactTop, exactBottom);
                        }
                    }
                }
            }
        }

        // Methods 1 & 2 already find all rectangles whose four sides are each present as
        // merged segments spanning the full boundary. Method 3 (intersection-based O(H²×V²)
        // exhaustive search) added marginal coverage at high CPU cost; removed since
        // LINE_GAP_TOLERANCE=30 on the merged segments handles the same broken-segment cases.

        const deduped = timer.timeSync('dedupeRectangles', () => dedupeRectangles(rectangles));
        return timer.timeSync('removeContainedRectangles', () => removeContainedRectangles(deduped));
    });
}

/**
 * Checks if two rectangles are adjacent (touching or very close) and similar in size
 */
function areAdjacentAndSimilar(rect1: Rectangle, rect2: Rectangle, adjacencyTolerance: number = config.RECT_DEDUP_TOLERANCE * 2, sizeSimilarityRatio: number = 0.5): boolean {
    // Check if rectangles are similar in size (within sizeSimilarityRatio)
    const area1 = rect1.width * rect1.height;
    const area2 = rect2.width * rect2.height;
    const areaRatio = Math.min(area1, area2) / Math.max(area1, area2);
    if (areaRatio < sizeSimilarityRatio) {
        return false; // Too different in size
    }

    // Check if rectangles are adjacent (horizontally or vertically)
    // Horizontal adjacency: one rectangle's right edge is near the other's left edge (or vice versa)
    const horizontalAdjacent = 
        (Math.abs(rect1.right - rect2.left) <= adjacencyTolerance && 
         rangesOverlap(rect1.top, rect1.bottom, rect2.top, rect2.bottom)) ||
        (Math.abs(rect2.right - rect1.left) <= adjacencyTolerance && 
         rangesOverlap(rect1.top, rect1.bottom, rect2.top, rect2.bottom));

    // Vertical adjacency: one rectangle's bottom edge is near the other's top edge (or vice versa)
    const verticalAdjacent = 
        (Math.abs(rect1.bottom - rect2.top) <= adjacencyTolerance && 
         rangesOverlap(rect1.left, rect1.right, rect2.left, rect2.right)) ||
        (Math.abs(rect2.bottom - rect1.top) <= adjacencyTolerance && 
         rangesOverlap(rect1.left, rect1.right, rect2.left, rect2.right));

    return horizontalAdjacent || verticalAdjacent;
}

/**
 * Merges multiple rectangles into a single bounding rectangle
 */
function mergeRectangles(rectangles: Rectangle[]): Rectangle {
    if (rectangles.length === 0) {
        throw new Error('Cannot merge empty rectangle array');
    }
    if (rectangles.length === 1) {
        return rectangles[0];
    }

    const left = Math.min(...rectangles.map(r => r.left));
    const right = Math.max(...rectangles.map(r => r.right));
    const top = Math.min(...rectangles.map(r => r.top));
    const bottom = Math.max(...rectangles.map(r => r.bottom));

    const width = right - left;
    const height = bottom - top;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    return {
        left,
        right,
        top,
        bottom,
        width,
        height,
        centerX,
        centerY
    };
}

/**
 * Helper function to check if two ranges overlap
 */
function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return Math.min(endA, endB) >= Math.max(startA, startB);
}

function rectangleFromBounds(left: number, right: number, top: number, bottom: number): Rectangle {
    return {
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
    };
}

function pickClosestToCenter(rectangles: Rectangle[], width: number, height: number): Rectangle {
    const centerX = width / 2;
    const centerY = height / 2;
    return rectangles.reduce((best, current) => {
        const bestDist = Math.hypot(best.centerX - centerX, best.centerY - centerY);
        const currentDist = Math.hypot(current.centerX - centerX, current.centerY - centerY);
        return currentDist < bestDist ? current : best;
    });
}

/**
 * Sheet border that includes the header and footer title blocks.
 * Older CAD pages inset that frame from the raster edge, so this is coverage-based
 * rather than "touches the image edge".
 */
function isPageFrameRectangle(rect: Rectangle, width: number, height: number): boolean {
    return rect.width >= width * config.OLD_PDF_PAGE_FRAME_WIDTH_RATIO
        && rect.height >= height * config.OLD_PDF_PAGE_FRAME_HEIGHT_RATIO;
}

/**
 * When the unit plan never closes as a 4-sided rect, rebuild the sheet from the
 * full-width border lines (title-block top/bottom). Never promote a narrow sidebar
 * stack to "page frame" — that swallows POZICIONI+photo as the center crop.
 */
function sheetFrameFromHorizontals(
    horizontals: HorizontalSegment[],
    width: number,
    height: number,
): Rectangle | null {
    const minLen = width * config.OLD_PDF_PAGE_FRAME_WIDTH_RATIO;
    const fullWidth = horizontals.filter((line) => (line.xEnd - line.xStart) >= minLen);
    if (fullWidth.length < 2) {
        return null;
    }
    const topLine = fullWidth.reduce((best, line) => (line.y < best.y ? line : best));
    const bottomLine = fullWidth.reduce((best, line) => (line.y > best.y ? line : best));
    if (bottomLine.y - topLine.y < height * config.OLD_PDF_PAGE_FRAME_HEIGHT_RATIO) {
        return null;
    }
    const left = Math.min(topLine.xStart, bottomLine.xStart);
    const right = Math.max(topLine.xEnd, bottomLine.xEnd);
    if (right - left < width * config.OLD_PDF_PAGE_FRAME_WIDTH_RATIO) {
        return null;
    }
    return rectangleFromBounds(left, right, topLine.y, bottomLine.y);
}

/**
 * Unit pages stack POZICIONI / photo / areas in a shared right column. Two or more
 * column-wide panels with aligned left edges mark that column so the unit-plan crop
 * can stop before it. A lone inner room on a floor sheet must not qualify.
 */
function findOldPdfRightColumnLeft(rectangles: Rectangle[], width: number): number | null {
    const panels = rectangles.filter((rect) =>
        rect.centerX >= width * config.OLD_PDF_TOP_RIGHT_MIN_CENTER_X_RATIO
        && rect.width >= width * config.OLD_PDF_RIGHT_COLUMN_MIN_WIDTH_RATIO
        && rect.width < width * config.OLD_PDF_TOP_RIGHT_MAX_WIDTH_RATIO
    );
    if (panels.length < 2) {
        return null;
    }
    const snap = config.LINE_SNAP_TOLERANCE;
    const buckets: {left: number; count: number}[] = [];
    for (const panel of panels) {
        const existing = buckets.find((bucket) => Math.abs(bucket.left - panel.left) <= snap);
        if (existing) {
            existing.left = (existing.left * existing.count + panel.left) / (existing.count + 1);
            existing.count += 1;
        } else {
            buckets.push({left: panel.left, count: 1});
        }
    }
    const column = buckets
        .filter((bucket) => bucket.count >= 2)
        .sort((a, b) => b.count - a.count || b.left - a.left)[0];
    return column ? column.left : null;
}

/**
 * Old CAD brochures draw a full-page sheet frame plus header/footer title blocks.
 * The closed 4-sided rectangle finder usually returns that sheet frame, so the
 * crop swallows the title blocks. Prefer a large inner plan panel when one exists;
 * otherwise crop the sheet between the header and footer separator lines.
 */
export function selectOldPdfCenterRectangle(
    rectangles: Rectangle[],
    horizontals: HorizontalSegment[],
    width: number,
    height: number,
): Rectangle | null {
    if (rectangles.length === 0) {
        return null;
    }

    const pageArea = Math.max(1, width * height);
    const innerPlanRects = rectangles.filter((rect) =>
        !isPageFrameRectangle(rect, width, height)
        && rect.width * rect.height >= pageArea * config.OLD_PDF_MIN_INNER_AREA_RATIO
    );
    if (innerPlanRects.length > 0) {
        return pickClosestToCenter(innerPlanRects, width, height);
    }

    const pageFrame = rectangles.find((rect) => isPageFrameRectangle(rect, width, height))
        ?? sheetFrameFromHorizontals(horizontals, width, height);
    if (!pageFrame) {
        return null;
    }
    const left = pageFrame.left;
    const columnLeft = findOldPdfRightColumnLeft(rectangles, width);
    const right = columnLeft != null && columnLeft > left + width * config.RECT_MIN_WIDTH_RATIO
        ? columnLeft
        : pageFrame.right;
    const frameTop = pageFrame.top;
    const frameBottom = pageFrame.bottom;
    const frameHeight = Math.max(1, frameBottom - frameTop);
    // Header/footer separators span the sheet, not the clipped unit-plan width.
    const sheetWidth = Math.max(1, pageFrame.right - pageFrame.left);

    const fullWidthMin = sheetWidth * config.OLD_PDF_FULL_WIDTH_LINE_RATIO;
    const band = frameHeight * config.OLD_PDF_TITLE_BLOCK_BAND_RATIO;
    const separatorTol = Math.max(config.RECT_DEDUP_TOLERANCE, frameHeight * 0.02);
    const headerYs = horizontals
        .filter((line) =>
            (line.xEnd - line.xStart) >= fullWidthMin
            && line.y > frameTop + separatorTol
            && line.y <= frameTop + band
        )
        .map((line) => line.y);
    const footerYs = horizontals
        .filter((line) =>
            (line.xEnd - line.xStart) >= fullWidthMin
            && line.y < frameBottom - separatorTol
            && line.y >= frameBottom - band
        )
        .map((line) => line.y);

    const fallbackInset = frameHeight * config.OLD_PDF_FALLBACK_INSET_RATIO;
    const headerBottom = headerYs.length > 0 ? Math.max(...headerYs) : null;
    const footerTop = footerYs.length > 0 ? Math.min(...footerYs) : null;

    const top = headerBottom != null && headerBottom >= frameTop + fallbackInset
        ? headerBottom
        : frameTop + fallbackInset;
    const bottom = footerTop != null && footerTop <= frameBottom - fallbackInset
        ? footerTop
        : frameBottom - fallbackInset;

    if (
        bottom - top < height * config.RECT_MIN_HEIGHT_RATIO
        || right - left < width * config.RECT_MIN_WIDTH_RATIO
    ) {
        return rectangleFromBounds(left, right, frameTop, frameBottom);
    }

    return rectangleFromBounds(left, right, top, bottom);
}

function boundsMatch(a: Rectangle, b: Rectangle): boolean {
    return Math.abs(a.left - b.left) <= config.RECT_DEDUP_TOLERANCE
        && Math.abs(a.right - b.right) <= config.RECT_DEDUP_TOLERANCE
        && Math.abs(a.top - b.top) <= config.RECT_DEDUP_TOLERANCE
        && Math.abs(a.bottom - b.bottom) <= config.RECT_DEDUP_TOLERANCE;
}

function topRightScore(rect: Rectangle, width: number, height: number): number {
    return (1 - rect.centerX / width) + (rect.centerY / height);
}

function hasOldPdfUnitRightColumn(centerRect: Rectangle | null, width: number): boolean {
    if (!centerRect) {
        return false;
    }
    return width - centerRect.right >= width * config.OLD_PDF_RIGHT_COLUMN_MIN_WIDTH_RATIO;
}

/**
 * Old CAD unit pages stack a position thumbnail, a photo, and an areas table in the
 * right column. The position drawing is only the top panel — never merge those
 * stacked boxes into one crop. Floor pages have no such column; inner rooms on
 * the right of the plan must not be treated as a POZICIONI panel.
 */
export function selectOldPdfTopRightRectangle(
    rectangles: Rectangle[],
    width: number,
    height: number,
    centerRect: Rectangle | null,
    horizontals: HorizontalSegment[] = [],
): Rectangle | null {
    if (!hasOldPdfUnitRightColumn(centerRect, width)) {
        return null;
    }
    const candidates = rectangles.filter((rect) => {
        if (isPageFrameRectangle(rect, width, height)) {
            return false;
        }
        if (centerRect && boundsMatch(rect, centerRect)) {
            return false;
        }
        if (centerRect && rect.left < centerRect.right - config.LINE_SNAP_TOLERANCE) {
            return false;
        }
        if (rect.centerX < width * config.OLD_PDF_TOP_RIGHT_MIN_CENTER_X_RATIO) {
            return false;
        }
        if (rect.top > height * config.OLD_PDF_TOP_RIGHT_MAX_TOP_RATIO) {
            return false;
        }
        if (rect.height >= height * config.OLD_PDF_TOP_RIGHT_MAX_HEIGHT_RATIO) {
            return false;
        }
        if (rect.width >= width * config.OLD_PDF_TOP_RIGHT_MAX_WIDTH_RATIO) {
            return false;
        }
        return true;
    });
    if (candidates.length > 0) {
        return candidates.reduce((best, current) =>
            topRightScore(current, width, height) < topRightScore(best, width, height) ? current : best
        );
    }
    return constructOldPdfTopRightFromPhotoEdge(horizontals, width, height, centerRect);
}

/**
 * When the photo's top edge was missing, no closed POZICIONI rectangle exists.
 * Build that panel from the right-column photo separator and the unit-plan top.
 */
function constructOldPdfTopRightFromPhotoEdge(
    horizontals: HorizontalSegment[],
    width: number,
    height: number,
    centerRect: Rectangle | null,
): Rectangle | null {
    const minLen = width * config.OLD_PDF_DARK_BLOCK_MIN_WIDTH_RATIO;
    const rightLines = horizontals.filter((line) =>
        (line.xEnd - line.xStart) >= minLen
        && line.xStart >= width * config.OLD_PDF_TOP_RIGHT_MIN_CENTER_X_RATIO
        && line.y >= height * 0.22
        && line.y <= height * 0.58
    );
    if (rightLines.length === 0) {
        return null;
    }
    const maxLen = Math.max(...rightLines.map((line) => line.xEnd - line.xStart));
    const photoTop = rightLines
        .filter((line) => (line.xEnd - line.xStart) >= maxLen * 0.9)
        .reduce((best, line) => (line.y < best.y ? line : best));

    const left = centerRect && centerRect.right < photoTop.xEnd
        ? centerRect.right
        : photoTop.xStart;
    const right = photoTop.xEnd;
    const top = centerRect && centerRect.top < photoTop.y
        ? centerRect.top
        : Math.max(0, photoTop.y - height * 0.35);
    const bottom = photoTop.y;
    if (
        bottom - top < height * config.RECT_MIN_HEIGHT_RATIO
        || bottom - top >= height * config.OLD_PDF_TOP_RIGHT_MAX_HEIGHT_RATIO
        || right - left < width * config.RECT_MIN_WIDTH_RATIO
        || right - left >= width * config.OLD_PDF_TOP_RIGHT_MAX_WIDTH_RATIO
    ) {
        return null;
    }
    return rectangleFromBounds(left, right, top, bottom);
}

/**
 * POZICIONI is an elevation on the left and the highlighted floor schematic on
 * the right, split by a full-height vertical. The schematic is what ORB aligns
 * to the floor master — the elevation is a different drawing.
 */
export function selectOldPdfPositionSchematic(
    panel: Rectangle,
    verticals: VerticalSegment[],
    horizontals: HorizontalSegment[] = [],
): Rectangle {
    const snap = config.LINE_SNAP_TOLERANCE;
    const midMin = panel.left + panel.width * 0.35;
    const midMax = panel.left + panel.width * 0.65;
    const buckets: {x: number; y0: number; y1: number}[] = [];
    for (const line of verticals) {
        if (line.x < midMin || line.x > midMax) {
            continue;
        }
        const y0 = Math.max(line.yStart, panel.top);
        const y1 = Math.min(line.yEnd, panel.bottom);
        if (y1 - y0 < 2) {
            continue;
        }
        const existing = buckets.find((bucket) => Math.abs(bucket.x - line.x) <= snap);
        if (existing) {
            existing.y0 = Math.min(existing.y0, y0);
            existing.y1 = Math.max(existing.y1, y1);
            existing.x = (existing.x + line.x) / 2;
        } else {
            buckets.push({x: line.x, y0, y1});
        }
    }
    const minSpan = panel.height * 0.35;
    const viable = buckets.filter((bucket) => bucket.y1 - bucket.y0 >= minSpan);
    const dividerX = viable.length === 0
        ? null
        : viable.reduce((best, bucket) =>
            Math.abs(bucket.x - panel.centerX) < Math.abs(best.x - panel.centerX) ? bucket : best
        ).x;

    let left = panel.left;
    let top = panel.top;
    const right = panel.right;
    const bottom = panel.bottom;
    if (dividerX != null && panel.right - dividerX >= panel.width * 0.25) {
        left = dividerX;
    }

    const titleBandTop = panel.top + panel.height * 0.04;
    const titleBandBottom = panel.top + panel.height * 0.28;
    const titleMinLen = panel.width * 0.5;
    const titleLines = horizontals.filter((line) =>
        line.y >= titleBandTop
        && line.y <= titleBandBottom
        && Math.min(line.xEnd, panel.right) - Math.max(line.xStart, panel.left) >= titleMinLen
    );
    if (titleLines.length > 0) {
        top = titleLines.reduce((best, line) => (line.y < best.y ? line : best)).y;
    }

    if (right - left < 2 || bottom - top < 2 || (left === panel.left && top === panel.top)) {
        return panel;
    }
    return rectangleFromBounds(left, right, top, bottom);
}

/**
 * Selects the rectangle closest to the center of the image and merges it with adjacent similar rectangles
 */
export function selectCenterRectangle(rectangles: Rectangle[], width: number, height: number): Rectangle | null {
    if (rectangles.length === 0) {
        return null;
    }
    const centerX = width / 2;
    const centerY = height / 2;
    const sorted = [...rectangles].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const candidates = sorted.slice(0, Math.min(10, sorted.length));
    const centerRect = candidates.reduce((best, current) => {
        const bestDist = Math.hypot(best.centerX - centerX, best.centerY - centerY);
        const currentDist = Math.hypot(current.centerX - centerX, current.centerY - centerY);
        return currentDist < bestDist ? current : best;
    });

    // Find all rectangles adjacent and similar to the center rectangle
    const rectanglesToMerge: Rectangle[] = [centerRect];
    const processed = new Set<Rectangle>([centerRect]);
    
    // Recursively find all adjacent similar rectangles
    const findAdjacent = (rect: Rectangle): void => {
        for (const other of rectangles) {
            if (processed.has(other)) continue;
            
            if (areAdjacentAndSimilar(rect, other)) {
                rectanglesToMerge.push(other);
                processed.add(other);
                // Recursively check this rectangle's neighbors
                findAdjacent(other);
            }
        }
    };

    // Start from center rectangle and find all connected adjacent rectangles
    findAdjacent(centerRect);

    // Merge all found rectangles into one
    return mergeRectangles(rectanglesToMerge);
}

/**
 * Selects the rectangle in the top-right area of the image.
 * Scores are normalized by image dimensions so the result is scale-independent.
 * Lower score = more top-right: penalizes distance from right edge + distance from top.
 */
export function selectTopRightRectangle(rectangles: Rectangle[], width: number, height: number): Rectangle | null {
    if (rectangles.length === 0) {
        return null;
    }
    const sorted = [...rectangles].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const candidates = sorted.slice(0, Math.min(10, sorted.length));
    return candidates.reduce((best, current) =>
        topRightScore(current, width, height) < topRightScore(best, width, height) ? current : best
    );
}

/**
 * Applies padding to a rectangle for cropping, then optionally removes a uniform inset from each side.
 * Inset is clamped so the crop stays at least 1×1 and within the padded bounds.
 */
export function applyCropPadding(rect: Rectangle, width: number, height: number, insetPerSide: number = 0): { left: number; top: number; width: number; height: number } {
    let left = Math.max(0, Math.floor(rect.left - config.CROP_PADDING));
    let top = Math.max(0, Math.floor(rect.top - config.CROP_PADDING));
    let right = Math.min(width - 1, Math.ceil(rect.right + config.CROP_PADDING));
    let bottom = Math.min(height - 1, Math.ceil(rect.bottom + config.CROP_PADDING));

    if (insetPerSide > 0) {
        const maxInsetX = Math.floor((right - left) / 2);
        const maxInsetY = Math.floor((bottom - top) / 2);
        const inset = Math.min(insetPerSide, maxInsetX, maxInsetY);
        left += inset;
        top += inset;
        right -= inset;
        bottom -= inset;
    }

    return {
        left,
        top,
        width: right - left + 1,
        height: bottom - top + 1
    };
}
