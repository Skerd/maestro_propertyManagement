import path from 'path';
import sharp from 'sharp';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {PerformanceTimer} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/performanceTimer';
import {
    applyCropPadding,
    findRectanglesFromLines,
    selectCenterRectangle,
    selectTopRightRectangle
} from './rectangleDetectionUtils';
import type {CropResult, LineDetection} from '../types';
import {buildRectanglesOverlaySvg} from "@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/imageUtils";

function clampExtractRegion(
    region: { left: number; top: number; width: number; height: number },
    imgW: number,
    imgH: number
): { left: number; top: number; width: number; height: number } {
    let { left, top, width, height } = region;
    left = Math.max(0, Math.floor(left));
    top = Math.max(0, Math.floor(top));
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (left >= imgW || top >= imgH) {
        return { left: 0, top: 0, width: Math.min(width, imgW), height: Math.min(height, imgH) };
    }
    width = Math.min(width, imgW - left);
    height = Math.min(height, imgH - top);
    return { left, top, width: Math.max(1, width), height: Math.max(1, height) };
}

export async function cropByRectangles(
    pagePath: string,
    detection: LineDetection,
    outputFolder: string,
    pageNumber: number,
    parentLogger: serverLogger,
    timer: PerformanceTimer,
    detailBuffer: Buffer,
    edgeInsetPx: number = 0,
): Promise<CropResult> {
    return await timer.timeAsync('cropByRectangles', async () => {
        const logger = getLogger("cropRectangles", parentLogger);
        logger.start("Crop rectangles...");
        const { width, height, horizontals, verticals } = detection;
        logger.debug("Finding rectangles from lines...");
        const rectangles = findRectanglesFromLines(horizontals, verticals, width, height, timer);
        if (rectangles.length === 0) {
            logger.warn('No rectangle boundaries detected from line overlay. Skipping rectangle cropping for this page.');
            return { rectangleCount: 0, excludeRectangles: [] };
        }
        logger.debug(`Found ${rectangles.length} rectangles.`);

        // Save rectangles overlay only if configured
        logger.debug("Overlaying rectangles on page image...");
        const rectanglesOutputPath = path.join(outputFolder, `page-${pageNumber}-rectangles.png`);
        const rectangleOverlay = buildRectanglesOverlaySvg(width, height, rectangles, null, null);
        await sharp(pagePath).composite([{input: Buffer.from(rectangleOverlay), blend: 'over'}]).png().toFile(rectanglesOutputPath);

        logger.debug("Done overlaying rectangles.");

        logger.debug("Selecting center rectangle...");
        const centerRect = selectCenterRectangle(rectangles, width, height);
        const remaining = centerRect ? rectangles.filter((rect) => rect !== centerRect) : rectangles;
        logger.debug(`Selected center rectangle!`);
        logger.debug(`Selecting top-right rectangle...`);
        const topRightRect = selectTopRightRectangle(remaining, width, height);
        logger.debug(`Selected top-right rectangle!`);

        // Semantic classification count used by classifyPageType:
        //   2 = unit layout  (large center detail + small top-right floor thumbnail)
        //   1 = floor layout (single large central plan, possibly with a title/legend box)
        //   0 = no usable rectangles found
        // A raw rectangle count is unreliable because floor pages often have a small title box
        // in addition to the main plan, producing count=2 but still being a floor page.
        let classificationRectCount: number;
        if (centerRect && topRightRect) {
            // topRightRect qualifies as a thumbnail only when it is noticeably smaller than
            // the page in both dimensions — a genuine unit-page floor thumbnail is narrow and short.
            const isThumbnail = topRightRect.width < width * 0.40 && topRightRect.height < height * 0.40;
            classificationRectCount = isThumbnail ? 2 : 1;
        }
        else {
            classificationRectCount = (centerRect || topRightRect) ? 1 : 0;
        }

        const cropResult: CropResult = {
            rectangleCount: classificationRectCount,
            // Only exclude plan panels from text reads — keep the bottom-right data/legend box readable
            excludeRectangles: [centerRect, topRightRect].filter((r): r is NonNullable<typeof r> => r != null),
        };

        const detailMeta = await sharp(detailBuffer).metadata();
        const detailIw = detailMeta.width ?? width;
        const detailIh = detailMeta.height ?? height;
        const scaleX = detailIw / Math.max(1, width);
        const scaleY = detailIh / Math.max(1, height);
        logger.debug(
            `Detail crop source ${detailIw}x${detailIh} px (scale ${scaleX.toFixed(3)}×, ${scaleY.toFixed(3)}× vs detection)`
        );

        async function extractCropToOut(crop: { left: number; top: number; width: number; height: number }, outFile: string): Promise<void> {
            const hi = clampExtractRegion(
                {
                    left: Math.round(crop.left * scaleX),
                    top: Math.round(crop.top * scaleY),
                    width: Math.round(crop.width * scaleX),
                    height: Math.round(crop.height * scaleY),
                },
                detailIw,
                detailIh
            );
            await sharp(detailBuffer).extract(hi).png().toFile(outFile);
        }

        logger.debug("Cropping rectangles...");
        if (centerRect) {
            const crop = applyCropPadding(centerRect, width, height, edgeInsetPx);
            const centerOutput = path.join(outputFolder, `page-${pageNumber}-center-unit-plan.png`);
            await extractCropToOut(crop, centerOutput);
            cropResult.centerUnitPath = centerOutput;
        }
        if (topRightRect) {
            const crop = applyCropPadding(topRightRect, width, height, edgeInsetPx);
            const topRightOutput = path.join(outputFolder, `page-${pageNumber}-top-right-floor-plan.png`);
            await extractCropToOut(crop, topRightOutput);
            cropResult.floorPlanPath = topRightOutput;
        }
        logger.debug("Done cropping rectangles.");

        logger.finish("Finished cropping rectangles!");
        return cropResult;
    });
}
