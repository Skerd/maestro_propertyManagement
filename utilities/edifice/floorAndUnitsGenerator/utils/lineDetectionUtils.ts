import sharp from 'sharp';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {config} from '../config';
import type {HorizontalSegment, LineDetection, VerticalSegment} from '../types';

/**
 * Trims horizontal segments to exact pixel boundaries
 * Ensures lines stop exactly where line pixels end
 * Handles both dark and light lines
 */
function trimHorizontalSegments(
    segments: HorizontalSegment[],
    data: Buffer,
    width: number,
    height: number
): HorizontalSegment[] {
    const trimmed: HorizontalSegment[] = [];
    const darkThreshold = config.DARK_PIXEL_THRESHOLD;

    for (const segment of segments) {
        if (segment.y < 0 || segment.y >= height) continue;

        const rowOffset = segment.y * width;
        
        // OPTIMIZATION: Since segments are already detected, just verify pixels are actually dark/light
        // This is much faster than re-running full detection logic
        let runStart = -1;

        for (let x = segment.xStart; x <= segment.xEnd; x += 1) {
            if (x >= 0 && x < width) {
                const value = data[rowOffset + x];
                // Check if pixel is dark (for dark lines) or has contrast with neighbors (for light lines)
                // Simplified check: dark pixel OR light pixel with dark neighbors above/below
                let isLinePixel = value <= darkThreshold;
                
                if (!isLinePixel && segment.y > 0 && segment.y < height - 1) {
                    // Check if it's a light line on dark background
                    const aboveValue = data[(segment.y - 1) * width + x];
                    const belowValue = data[(segment.y + 1) * width + x];
                    if (aboveValue <= darkThreshold && belowValue <= darkThreshold) {
                        // Light pixel with dark above and below = light line
                        isLinePixel = true;
                    }
                }
                
                if (isLinePixel) {
                    if (runStart === -1) {
                        runStart = x;
                    }
                } else {
                    if (runStart !== -1) {
                        // Found a continuous run, add it
                        trimmed.push({
                            y: segment.y,
                            xStart: runStart,
                            xEnd: x - 1
                        });
                        runStart = -1;
                    }
                }
            }
        }

        // Check if there's a run that extends to the end
        if (runStart !== -1) {
            trimmed.push({
                y: segment.y,
                xStart: runStart,
                xEnd: segment.xEnd
            });
        }
    }

    return trimmed;
}

/**
 * Checks if a pixel is part of a horizontal line drawn inside a dark region
 * Detects BOTH:
 * - Dark lines (darker than surrounding dark background)
 * - Light lines (lighter than surrounding dark background - like white/light gray on black)
 * OPTIMIZED: Uses faster sampling strategy (checks fewer neighbors, early exit)
 */
function isHorizontalLineInDarkRegion(data: Buffer, width: number, height: number, x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    
    const value = data[y * width + x];
    const rowOffset = y * width;
    
    // OPTIMIZATION: Quick check - sample fewer neighbors in a cross pattern instead of full square
    // This is much faster (checks ~8 neighbors instead of 49)
    let darkNeighborCount = 0;
    let totalNeighbors = 0;
    const sampleRadius = 2; // Reduced from 3 for performance
    
    // Sample in cross pattern: horizontal and vertical neighbors only (faster than full square)
    // Check horizontal neighbors
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += 1) {
        if (dx === 0) continue; // Skip center
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
            totalNeighbors += 1;
            if (data[rowOffset + nx] <= config.DARK_PIXEL_THRESHOLD) {
                darkNeighborCount += 1;
            }
        }
    }
    
    // Check vertical neighbors (above and below)
    for (let dy = -sampleRadius; dy <= sampleRadius; dy += 1) {
        if (dy === 0) continue; // Skip center
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
            totalNeighbors += 1;
            if (data[ny * width + x] <= config.DARK_PIXEL_THRESHOLD) {
                darkNeighborCount += 1;
            }
        }
    }
    
    // Early exit: if not enough dark neighbors, we're not in a dark region
    if (totalNeighbors === 0 || (darkNeighborCount / totalNeighbors) <= 0.4) {
        return false;
    }
    
    // Check for horizontal line: compare with pixels above and below
    const lineContrastThreshold = 10; // Lower threshold to catch faint lines
    
    if (y > 0 && y < height - 1) {
        const aboveValue = data[(y - 1) * width + x];
        const belowValue = data[(y + 1) * width + x];
        
        // Case 1: Dark line (darker than surrounding dark background)
        if (value <= config.DARK_PIXEL_THRESHOLD) {
            const aboveContrast = aboveValue - value;
            const belowContrast = belowValue - value;
            
            // If this row is darker than both rows above and below
            if (aboveContrast >= lineContrastThreshold && belowContrast >= lineContrastThreshold) {
                return true;
            }
            
            // Or if there's significant contrast in at least one direction
            if (aboveContrast >= lineContrastThreshold || belowContrast >= lineContrastThreshold) {
                // Check horizontal neighbors for consistency
                if (x > 0 && x < width - 1) {
                    const leftValue = data[y * width + (x - 1)];
                    const rightValue = data[y * width + (x + 1)];
                    if (leftValue <= config.DARK_PIXEL_THRESHOLD && rightValue <= config.DARK_PIXEL_THRESHOLD) {
                        return true; // Part of a horizontal dark line
                    }
                }
            }
        }
        
        // Case 2: Light line (lighter than surrounding dark background)
        // This catches white/light gray lines drawn on dark backgrounds
        if (value > config.DARK_PIXEL_THRESHOLD) {
            // Check if rows above and below are dark (we're in a dark region)
            const aboveIsDark = aboveValue <= config.DARK_PIXEL_THRESHOLD;
            const belowIsDark = belowValue <= config.DARK_PIXEL_THRESHOLD;
            
            if (aboveIsDark && belowIsDark) {
                // This is a light pixel with dark pixels above and below
                // Check if it's significantly lighter (a light line on dark background)
                const contrastAbove = value - aboveValue;
                const contrastBelow = value - belowValue;
                
                if (contrastAbove >= lineContrastThreshold && contrastBelow >= lineContrastThreshold) {
                    return true; // Light line on dark background
                }
                
                // Also check if neighbors horizontally are also light (continuous light line)
                if (x > 0 && x < width - 1) {
                    const leftValue = data[y * width + (x - 1)];
                    const rightValue = data[y * width + (x + 1)];
                    const leftIsLight = leftValue > config.DARK_PIXEL_THRESHOLD;
                    const rightIsLight = rightValue > config.DARK_PIXEL_THRESHOLD;
                    
                    // If neighbors are also light, it's part of a continuous light line
                    if (leftIsLight || rightIsLight) {
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
}

/**
 * Detects horizontal lines from image data
 * Detects edges of dark regions, lines inside dark regions, AND continuous lines that span boundaries
 */
function detectHorizontalLines(
    data: Buffer,
    width: number,
    height: number,
    timer: PerformanceTimer,
    horizontalRunRatio: number = config.HORIZONTAL_RUN_RATIO,
): HorizontalSegment[] {
    const segments: HorizontalSegment[] = [];
    const minRun = Math.max(1, Math.round(width * horizontalRunRatio));
    
    // OPTIMIZATION: Pre-compute threshold check to avoid repeated comparisons
    const darkThreshold = config.DARK_PIXEL_THRESHOLD;

    for (let y = 0; y < height; y += 1) {
        const rowOffset = y * width;
        let runStart = -1;

        for (let x = 0; x < width; x += 1) {
            // OPTIMIZATION: Inline fast edge check first before calling expensive functions
            const value = data[rowOffset + x];
            let isLine = false;
            
            // Fast path: check for simple edge case (most common)
            if (value <= darkThreshold) {
                // Quick edge check
                if (y > 0) {
                    const aboveValue = data[(y - 1) * width + x];
                    if (aboveValue > darkThreshold) {
                        isLine = true;
                    }
                } else {
                    isLine = true; // Top edge
                }
                
                if (!isLine && y < height - 1) {
                    const belowValue = data[(y + 1) * width + x];
                    if (belowValue > darkThreshold) {
                        isLine = true; // Bottom edge
                    }
                } else if (!isLine && y === height - 1) {
                    isLine = true; // Bottom edge
                }
            }
            
            // If not a simple edge, check other cases (more expensive)
            // OPTIMIZATION: Skip edge check in isHorizontalLinePixel since we already did it
            if (!isLine) {
                // Check if it's a line in dark region or continuous line (skip edge check)
                isLine = isHorizontalLineInDarkRegion(data, width, height, x, y);
                
                // If still not found, check for continuous horizontal line (but skip edge check)
                if (!isLine) {
                    // Check if there are similar pixels to the left and/or right
                    let hasLeftSimilar = false;
                    let hasRightSimilar = false;
                    
                    if (x > 0) {
                        const leftValue = data[rowOffset + (x - 1)];
                        const bothDark = value <= darkThreshold && leftValue <= darkThreshold;
                        const bothLight = value > darkThreshold && leftValue > darkThreshold;
                        hasLeftSimilar = bothDark || bothLight || Math.abs(value - leftValue) < 20;
                    }
                    
                    if (x < width - 1) {
                        const rightValue = data[rowOffset + (x + 1)];
                        const bothDark = value <= darkThreshold && rightValue <= darkThreshold;
                        const bothLight = value > darkThreshold && rightValue > darkThreshold;
                        hasRightSimilar = bothDark || bothLight || Math.abs(value - rightValue) < 20;
                    }
                    
                    if (hasLeftSimilar && hasRightSimilar && y > 0 && y < height - 1) {
                        const aboveValue = data[(y - 1) * width + x];
                        const belowValue = data[(y + 1) * width + x];
                        const aboveIsLight = aboveValue > darkThreshold;
                        const belowIsLight = belowValue > darkThreshold;
                        const valueIsDark = value <= darkThreshold;
                        
                        if ((valueIsDark && (aboveIsLight || belowIsLight)) || 
                            (!valueIsDark && (!aboveIsLight || !belowIsLight))) {
                            isLine = true;
                        }
                    } else if (hasLeftSimilar && hasRightSimilar) {
                        isLine = true; // At boundary
                    }
                }
            }
            
            if (isLine) {
                if (runStart === -1) {
                    runStart = x;
                }
            } else {
                // End of line run
                if (runStart !== -1) {
                    const runLength = x - runStart;
                    if (runLength >= minRun) {
                        segments.push({ y, xStart: runStart, xEnd: x - 1 });
                    }
                    runStart = -1;
                }
            }
        }

        // Handle line run that extends to end of row
        if (runStart !== -1) {
            const runLength = width - runStart;
            if (runLength >= minRun) {
                segments.push({ y, xStart: runStart, xEnd: width - 1 });
            }
        }
    }

    // Trim segments to ensure they only include dark pixels
    return timer.timeSync('trimHorizontalSegments', () => trimHorizontalSegments(segments, data, width, height));
}

/**
 * Trims vertical segments to exact dark pixel boundaries
 * Ensures lines stop exactly where dark pixels end
 * Returns all continuous dark pixel runs within each segment
 */
function trimVerticalSegments(
    segments: VerticalSegment[],
    data: Buffer,
    width: number,
    height: number
): VerticalSegment[] {
    const trimmed: VerticalSegment[] = [];

    for (const segment of segments) {
        if (segment.x < 0 || segment.x >= width) continue;

        // Find all continuous dark pixel runs within this segment
        let runStart = -1;

        for (let y = segment.yStart; y <= segment.yEnd; y += 1) {
            if (y >= 0 && y < height) {
                const value = data[y * width + segment.x];
                if (value <= config.DARK_PIXEL_THRESHOLD) {
                    if (runStart === -1) {
                        runStart = y;
                    }
                } else {
                    if (runStart !== -1) {
                        // Found a continuous run, add it
                        trimmed.push({
                            x: segment.x,
                            yStart: runStart,
                            yEnd: y - 1
                        });
                        runStart = -1;
                    }
                }
            }
        }

        // Check if there's a run that extends to the end
        if (runStart !== -1) {
            trimmed.push({
                x: segment.x,
                yStart: runStart,
                yEnd: segment.yEnd
            });
        }
    }

    return trimmed;
}

/**
 * Detects vertical lines from image data
 * Only detects edges of dark regions (left/right borders), not fills
 */
function detectVerticalLines(
    data: Buffer,
    width: number,
    height: number,
    timer: PerformanceTimer,
    verticalRunRatio: number = config.VERTICAL_RUN_RATIO,
): VerticalSegment[] {
    const segments: VerticalSegment[] = [];
    const minRun = Math.max(1, Math.round(height * verticalRunRatio));
    
    // OPTIMIZATION: Pre-compute threshold check
    const darkThreshold = config.DARK_PIXEL_THRESHOLD;

    for (let x = 0; x < width; x += 1) {
        let runStart = -1;

        for (let y = 0; y < height; y += 1) {
            // OPTIMIZATION: Inline fast edge check first
            const value = data[y * width + x];
            let isEdge = false;
            
            // Fast path: check for simple edge case
            if (value <= darkThreshold) {
                // Quick edge check
                if (x > 0) {
                    const leftValue = data[y * width + (x - 1)];
                    if (leftValue > darkThreshold) {
                        isEdge = true; // Left edge
                    }
                } else {
                    isEdge = true; // Left edge of image
                }
                
                if (!isEdge && x < width - 1) {
                    const rightValue = data[y * width + (x + 1)];
                    if (rightValue > darkThreshold) {
                        isEdge = true; // Right edge
                    }
                } else if (!isEdge && x === width - 1) {
                    isEdge = true; // Right edge of image
                }
            }
            
            if (isEdge) {
                if (runStart === -1) {
                    runStart = y;
                }
            } else {
                // End of edge run
                if (runStart !== -1) {
                    const runLength = y - runStart;
                    if (runLength >= minRun) {
                        segments.push({ x, yStart: runStart, yEnd: y - 1 });
                    }
                    runStart = -1;
                }
            }
        }

        // Handle edge run that extends to end of column
        if (runStart !== -1) {
            const runLength = height - runStart;
            if (runLength >= minRun) {
                segments.push({ x, yStart: runStart, yEnd: height - 1 });
            }
        }
    }

    // Trim segments to ensure they only include dark edge pixels
    return timer.timeSync('trimVerticalSegments', () => trimVerticalSegments(segments, data, width, height));
}

/**
 * Splits horizontal lines at intersection points with vertical lines
 */
function splitHorizontalLinesAtIntersections(horizontals: HorizontalSegment[], verticals: VerticalSegment[]): HorizontalSegment[] {
    const split: HorizontalSegment[] = [];
    const intersectionTolerance = config.LINE_SNAP_TOLERANCE;

    for (const hLine of horizontals) {
        // Find all vertical lines that intersect this horizontal line
        const intersectingVerticals = verticals.filter((vLine) => {
            // Check if vertical line intersects horizontal line
            const xIntersects = vLine.x >= hLine.xStart - intersectionTolerance &&
                vLine.x <= hLine.xEnd + intersectionTolerance;
            const yIntersects = hLine.y >= vLine.yStart - intersectionTolerance &&
                hLine.y <= vLine.yEnd + intersectionTolerance;
            return xIntersects && yIntersects;
        });

        if (intersectingVerticals.length === 0) {
            // No intersections, keep line as-is
            split.push(hLine);
            continue;
        }

        // Collect all intersection x positions
        const intersectionPoints = intersectingVerticals
            .map(v => v.x)
            .filter(x => x >= hLine.xStart && x <= hLine.xEnd)
            .sort((a, b) => a - b);

        // Remove duplicates and add boundaries
        const uniquePoints = Array.from(new Set(intersectionPoints));

        if (uniquePoints.length === 0) {
            // No valid intersections within line bounds
            split.push(hLine);
            continue;
        }

        // Split the line at each intersection point
        let currentStart = hLine.xStart;

        for (const intersectionX of uniquePoints) {
            // Create segment from current start to intersection (if long enough)
            if (intersectionX > currentStart + 1) {
                split.push({
                    y: hLine.y,
                    xStart: currentStart,
                    xEnd: intersectionX
                });
            }
            // Start next segment after intersection
            currentStart = intersectionX;
        }

        // Add final segment from last intersection to end (if long enough)
        if (hLine.xEnd > currentStart + 1) {
            split.push({
                y: hLine.y,
                xStart: currentStart,
                xEnd: hLine.xEnd
            });
        }
    }

    return split;
}

/**
 * Splits vertical lines at intersection points with horizontal lines
 */
function splitVerticalLinesAtIntersections(verticals: VerticalSegment[], horizontals: HorizontalSegment[]): VerticalSegment[] {
    const split: VerticalSegment[] = [];
    const intersectionTolerance = config.LINE_SNAP_TOLERANCE;

    for (const vLine of verticals) {
        // Find all horizontal lines that intersect this vertical line
        const intersectingHorizontals = horizontals.filter((hLine) => {
            // Check if horizontal line intersects vertical line
            const xIntersects = hLine.xStart <= vLine.x + intersectionTolerance &&
                hLine.xEnd >= vLine.x - intersectionTolerance;
            // Check if horizontal line's y is within vertical line's y range
            const yIntersects = hLine.y >= vLine.yStart - intersectionTolerance &&
                hLine.y <= vLine.yEnd + intersectionTolerance;
            return xIntersects && yIntersects;
        });

        if (intersectingHorizontals.length === 0) {
            // No intersections, keep line as-is
            split.push(vLine);
            continue;
        }

        // Collect all intersection y positions
        const intersectionPoints = intersectingHorizontals
            .map(h => h.y)
            .filter(y => y >= vLine.yStart && y <= vLine.yEnd)
            .sort((a, b) => a - b);

        // Remove duplicates and add boundaries
        const uniquePoints = Array.from(new Set(intersectionPoints));

        if (uniquePoints.length === 0) {
            // No valid intersections within line bounds
            split.push(vLine);
            continue;
        }

        // Split the line at each intersection point
        let currentStart = vLine.yStart;

        for (const intersectionY of uniquePoints) {
            // Create segment from current start to intersection (if long enough)
            if (intersectionY > currentStart + 1) {
                split.push({
                    x: vLine.x,
                    yStart: currentStart,
                    yEnd: intersectionY
                });
            }
            // Start next segment after intersection
            currentStart = intersectionY;
        }

        // Add final segment from last intersection to end (if long enough)
        if (vLine.yEnd > currentStart + 1) {
            split.push({
                x: vLine.x,
                yStart: currentStart,
                yEnd: vLine.yEnd
            });
        }
    }

    return split;
}

/**
 * Merges similar horizontal lines that are collinear (same row) and close together
 * Connects lines that should be treated as a single continuous line
 */
function mergeSimilarHorizontalLines(segments: HorizontalSegment[]): HorizontalSegment[] {
    if (segments.length === 0) {
        return [];
    }

    const sorted = [...segments].sort((a, b) => (a.y - b.y) || (a.xStart - b.xStart));
    const merged: HorizontalSegment[] = [];
    
    // Group segments by y-coordinate (within tolerance)
    let currentGroup: HorizontalSegment[] = [sorted[0]];

    for (let index = 1; index < sorted.length; index += 1) {
        const segment = sorted[index];
        const lastSegment = currentGroup[currentGroup.length - 1];
        
        // Check if this segment is on the same row (within tolerance)
        if (Math.abs(segment.y - lastSegment.y) <= config.LINE_MERGE_TOLERANCE) {
            currentGroup.push(segment);
            continue;
        }

        // Process the completed group - merge collinear segments
        mergeCollinearHorizontalGroup(currentGroup, merged);

        // Start new group
        currentGroup = [segment];
    }

    // Handle final group
    mergeCollinearHorizontalGroup(currentGroup, merged);

    return merged;
}

/**
 * Merges a group of horizontal segments that are on the same row
 */
function mergeCollinearHorizontalGroup(group: HorizontalSegment[], merged: HorizontalSegment[]): void {
    if (group.length === 0) return;

    // Sort by xStart
    const sorted = [...group].sort((a, b) => a.xStart - b.xStart);
    
    // Use the average y-coordinate for merged segments
    const avgY = Math.round(group.reduce((sum, s) => sum + s.y, 0) / group.length);
    
    let current = { ...sorted[0], y: avgY };

    for (let index = 1; index < sorted.length; index += 1) {
        const next = sorted[index];
        
        // If segments are close enough (gap tolerance), merge them
        if (next.xStart - current.xEnd <= config.LINE_GAP_TOLERANCE) {
            // Merge: extend current segment to include next
            current.xEnd = Math.max(current.xEnd, next.xEnd);
        } else {
            // Gap is too large, keep as separate segments
            merged.push(current);
            current = { ...next, y: avgY };
        }
    }
    
    merged.push(current);
}

/**
 * Merges similar vertical lines that are collinear (same column) and close together
 * Connects lines that should be treated as a single continuous line
 */
function mergeSimilarVerticalLines(segments: VerticalSegment[]): VerticalSegment[] {
    if (segments.length === 0) {
        return [];
    }

    const sorted = [...segments].sort((a, b) => (a.x - b.x) || (a.yStart - b.yStart));
    const merged: VerticalSegment[] = [];
    
    // Group segments by x-coordinate (within tolerance)
    let currentGroup: VerticalSegment[] = [sorted[0]];

    for (let index = 1; index < sorted.length; index += 1) {
        const segment = sorted[index];
        const lastSegment = currentGroup[currentGroup.length - 1];
        
        // Check if this segment is on the same column (within tolerance)
        if (Math.abs(segment.x - lastSegment.x) <= config.LINE_MERGE_TOLERANCE) {
            currentGroup.push(segment);
            continue;
        }

        // Process the completed group - merge collinear segments
        mergeCollinearVerticalGroup(currentGroup, merged);

        // Start new group
        currentGroup = [segment];
    }

    // Handle final group
    mergeCollinearVerticalGroup(currentGroup, merged);

    return merged;
}

/**
 * Merges a group of vertical segments that are on the same column
 */
function mergeCollinearVerticalGroup(group: VerticalSegment[], merged: VerticalSegment[]): void {
    if (group.length === 0) return;

    // Sort by yStart
    const sorted = [...group].sort((a, b) => a.yStart - b.yStart);
    
    // Use the average x-coordinate for merged segments
    const avgX = Math.round(group.reduce((sum, s) => sum + s.x, 0) / group.length);
    
    let current = { ...sorted[0], x: avgX };

    for (let index = 1; index < sorted.length; index += 1) {
        const next = sorted[index];
        
        // If segments are close enough (gap tolerance), merge them
        if (next.yStart - current.yEnd <= config.LINE_GAP_TOLERANCE) {
            // Merge: extend current segment to include next
            current.yEnd = Math.max(current.yEnd, next.yEnd);
        } else {
            // Gap is too large, keep as separate segments
            merged.push(current);
            current = { ...next, x: avgX };
        }
    }
    
    merged.push(current);
}

export type DetectLinesOptions = {
    /** Override {@link config.HORIZONTAL_RUN_RATIO}. Lower = shorter wall segments kept. */
    horizontalRunRatio?: number;
    /** Override {@link config.VERTICAL_RUN_RATIO}. */
    verticalRunRatio?: number;
};

/**
 * Detects lines from an image Buffer or Sharp instance (in-memory, faster)
 */
export async function detectLinesFromBuffer(
    inputImage: Buffer | sharp.Sharp,
    parentLogger: serverLogger,
    timer: PerformanceTimer,
    options: DetectLinesOptions = {},
): Promise<LineDetection> {
    return await timer.timeAsync('detectLinesFromBuffer', async () => {
        const logger = getLogger("detect_lines_from_buffer", parentLogger);
        logger.start("Detecting lines from image buffer...");

        const hRatio = options.horizontalRunRatio ?? config.HORIZONTAL_RUN_RATIO;
        const vRatio = options.verticalRunRatio ?? config.VERTICAL_RUN_RATIO;

        const sharpInstance = Buffer.isBuffer(inputImage) ? sharp(inputImage) : inputImage;
        const { data, info } = await sharpInstance.greyscale().raw().toBuffer({ resolveWithObject: true });
        const { width, height } = info;
        logger.debug(
            `Detecting horizontal and vertical lines (minRun H=${(hRatio * 100).toFixed(1)}% W, V=${(vRatio * 100).toFixed(1)}% H)...`
        );
        let horizontals = timer.timeSync('detectHorizontalLines', () => detectHorizontalLines(data, width, height, timer, hRatio));
        let verticals = timer.timeSync('detectVerticalLines', () => detectVerticalLines(data, width, height, timer, vRatio));
        logger.debug("Finished detecting horizontal and vertical lines!");

        logger.debug("Splitting lines at intersections...");
        horizontals = timer.timeSync('splitHorizontalLinesAtIntersections', () => splitHorizontalLinesAtIntersections(horizontals, verticals));
        verticals = timer.timeSync('splitVerticalLinesAtIntersections', () => splitVerticalLinesAtIntersections(verticals, horizontals));
        logger.debug("Finished splitting lines at intersections!");

        // Final trimming to ensure all segments only include dark pixels
        logger.debug("Trimming segments to exact dark pixel boundaries...");
        horizontals = timer.timeSync('trimHorizontalSegmentsFinal', () => trimHorizontalSegments(horizontals, data, width, height));
        verticals = timer.timeSync('trimVerticalSegmentsFinal', () => trimVerticalSegments(verticals, data, width, height));
        logger.debug("Finished trimming segments!");

        // Merge similar collinear lines that are close together
        logger.debug("Merging similar collinear lines...");
        horizontals = timer.timeSync('mergeSimilarHorizontalLines', () => mergeSimilarHorizontalLines(horizontals));
        verticals = timer.timeSync('mergeSimilarVerticalLines', () => mergeSimilarVerticalLines(verticals));
        logger.debug("Finished merging similar lines!");

        logger.finish("Finished detecting lines from image.");
        return { width, height, horizontals, verticals };
    });
}
