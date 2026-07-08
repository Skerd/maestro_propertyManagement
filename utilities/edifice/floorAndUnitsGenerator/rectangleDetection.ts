import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from './config';
import type {HorizontalSegment, Rectangle, VerticalSegment} from './types';

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
 * Removes rectangles that contain other rectangles
 */
function removeContainingRectangles(rectangles: Rectangle[]): Rectangle[] {
    if (rectangles.length === 0) {
        return [];
    }

    // Filter out rectangles that contain any other rectangles
    return rectangles.filter((rect) => {
        // Check if this rectangle contains any other rectangle
        const containsOther = rectangles.some((other) => {
            if (rect === other) {
                return false; // Skip self
            }
            return contains(rect, other);
        });

        // Keep only rectangles that don't contain others
        return !containsOther;
    });
}

/**
 * Merges horizontal segments that are close together
 */
function mergeHorizontalSegments(segments: HorizontalSegment[], timer: PerformanceTimer): HorizontalSegment[] {
    return timer.timeSync('mergeHorizontalSegments', () => {
        if (segments.length === 0) {
            return [];
        }
        const sorted = [...segments].sort((a, b) => (a.y - b.y) || (a.xStart - b.xStart));
        const merged: HorizontalSegment[] = [];
        let group: HorizontalSegment[] = [sorted[0]];
        let groupSumY = sorted[0].y;

        const flushGroup = (): void => {
            const y = Math.round(groupSumY / group.length);
            const parts = [...group].sort((a, b) => a.xStart - b.xStart);
            let current = { ...parts[0], y };
            for (let index = 1; index < parts.length; index += 1) {
                const next = parts[index];
                if (next.xStart - current.xEnd <= config.LINE_GAP_TOLERANCE) {
                    current.xEnd = Math.max(current.xEnd, next.xEnd);
                } else {
                    merged.push(current);
                    current = { ...next, y };
                }
            }
            merged.push(current);
        };

        for (let index = 1; index < sorted.length; index += 1) {
            const segment = sorted[index];
            if (Math.abs(segment.y - group[group.length - 1].y) <= config.LINE_MERGE_TOLERANCE) {
                group.push(segment);
                groupSumY += segment.y;
            } else {
                flushGroup();
                group = [segment];
                groupSumY = segment.y;
            }
        }
        flushGroup();
        return merged;
    });
}

/**
 * Merges vertical segments that are close together
 */
function mergeVerticalSegments(segments: VerticalSegment[], timer: PerformanceTimer): VerticalSegment[] {
    return timer.timeSync('mergeVerticalSegments', () => {
        if (segments.length === 0) {
            return [];
        }
        const sorted = [...segments].sort((a, b) => (a.x - b.x) || (a.yStart - b.yStart));
        const merged: VerticalSegment[] = [];
        let group: VerticalSegment[] = [sorted[0]];
        let groupSumX = sorted[0].x;

        const flushGroup = (): void => {
            const x = Math.round(groupSumX / group.length);
            const parts = [...group].sort((a, b) => a.yStart - b.yStart);
            let current = { ...parts[0], x };
            for (let index = 1; index < parts.length; index += 1) {
                const next = parts[index];
                if (next.yStart - current.yEnd <= config.LINE_GAP_TOLERANCE) {
                    current.yEnd = Math.max(current.yEnd, next.yEnd);
                } else {
                    merged.push(current);
                    current = { ...next, x };
                }
            }
            merged.push(current);
        };

        for (let index = 1; index < sorted.length; index += 1) {
            const segment = sorted[index];
            if (Math.abs(segment.x - group[group.length - 1].x) <= config.LINE_MERGE_TOLERANCE) {
                group.push(segment);
                groupSumX += segment.x;
            } else {
                flushGroup();
                group = [segment];
                groupSumX = segment.x;
            }
        }
        flushGroup();
        return merged;
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
    return Math.abs(vLine.yStart - hY) <= tolerance ||
        Math.abs(vLine.yEnd - hY) <= tolerance ||
        (vLine.yStart <= hY && vLine.yEnd >= hY);
}

/**
 * Checks if a horizontal line intersects with a vertical range
 */
function horizontalIntersectsVertical(hLine: HorizontalSegment, vX: number, tolerance: number = config.LINE_SNAP_TOLERANCE): boolean {
    return Math.abs(hLine.xStart - vX) <= tolerance ||
        Math.abs(hLine.xEnd - vX) <= tolerance ||
        (hLine.xStart <= vX && hLine.xEnd >= vX);
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
export function findRectanglesFromLines(
    horizontals: HorizontalSegment[],
    verticals: VerticalSegment[],
    width: number,
    height: number,
    timer: PerformanceTimer
): Rectangle[] {
    return timer.timeSync('findRectanglesFromLines', () => {
        const minWidth = Math.round(width * config.RECT_MIN_WIDTH_RATIO);
        const minHeight = Math.round(height * config.RECT_MIN_HEIGHT_RATIO);
        const maxWidth = Math.round(width * config.RECT_MAX_WIDTH_RATIO);
        const maxHeight = Math.round(height * config.RECT_MAX_HEIGHT_RATIO);

        const mergedHorizontals = mergeHorizontalSegments(horizontals, timer).filter((line) => line.xEnd - line.xStart + 1 >= minWidth);
        const mergedVerticals = mergeVerticalSegments(verticals, timer).filter((line) => line.yEnd - line.yStart + 1 >= minHeight);

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
        for (let i = 0; i < mergedHorizontals.length; i += 1) {
            const topLine = mergedHorizontals[i];
            for (let j = i + 1; j < mergedHorizontals.length; j += 1) {
                const bottomLine = mergedHorizontals[j];
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
                for (const vLine of mergedVerticals) {
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
        for (let i = 0; i < mergedVerticals.length; i += 1) {
            const vLine1 = mergedVerticals[i];
            for (let j = i + 1; j < mergedVerticals.length; j += 1) {
                const vLine2 = mergedVerticals[j];

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
                for (const hLine of mergedHorizontals) {
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
        return timer.timeSync('removeContainingRectangles', () => removeContainingRectangles(deduped));
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
    return candidates.reduce((best, current) => {
        const bestScore = (1 - best.centerX / width) + (best.centerY / height);
        const currentScore = (1 - current.centerX / width) + (current.centerY / height);
        return currentScore < bestScore ? current : best;
    });
}

/**
 * Applies padding to a rectangle for cropping, then optionally removes a uniform inset from each side.
 * Inset is clamped so the crop stays at least 1×1 and within the padded bounds.
 */
export function applyCropPadding(
    rect: Rectangle,
    width: number,
    height: number,
    insetPerSide: number = 0
): { left: number; top: number; width: number; height: number } {
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
