export type PageImageResult = {
    pageNumber: number;
    outputPath: string;
    width: number;
    height: number;
    centerUnitPath?: string;
    floorPlanPath?: string;
    /**
     * Number of "big" rectangles (>= RECT_MIN_*_RATIO of page) detected on this page.
     * Used by classifyPageType as the strongest visual signal: a floor page should
     * show exactly 1 big rectangle (the master plan), a unit page 2+ (top-right
     * floor thumbnail + center unit detail). 0 means line detection did not yield
     * any usable rectangle, in which case classification falls back to OCR text rules.
     */
    rectangleCount: number;
    renderedImageBuffer?: Buffer; // Keep rendered image in memory for OCR if needed
};

export type PolygonPoint = {
    x: number;
    y: number;
};

export type UnitSummary = {
    name: string;
    netArea: number;
    sharedArea: number;
    totalArea: number;
    verandaArea: number;
    confidence: number;
    rawTextLength: number;
    pageNumber: number;
    /**
     * Outline of the highlighted unit region, as polygon vertices in fractional
     * coordinates (x∈[0,1] of reference width, y∈[0,1] of reference height).
     * When thumbnail-to-floor registration succeeds (opencvNode pipeline), the
     * reference is the per-floor master `floor-plan.png` so overlays map onto
     * the full layout; otherwise fractions are relative to the unit's cropped
     * top-right floor thumbnail.
     */
    polygonCoordinates?: PolygonPoint[];
};

export type FloorSummary = {
    floor: string;
    /** 1-indexed brochure page classified as this floor's master page (if any). */
    pageNumber?: number;
    units: Record<string, UnitSummary[]>;
};

export type OcrSummary = {
    floors: Record<string, FloorSummary>;
};

export type CropResult = {
    centerUnitPath?: string;
    floorPlanPath?: string;
    /** Total number of big rectangles detected on the page (after dedup/size filtering). */
    rectangleCount: number;
};

export type HorizontalSegment = {
    y: number;
    xStart: number;
    xEnd: number;
};

export type VerticalSegment = {
    x: number;
    yStart: number;
    yEnd: number;
};

export type LineDetection = {
    width: number;
    height: number;
    horizontals: HorizontalSegment[];
    verticals: VerticalSegment[];
};

export type Rectangle = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
};

export type HorizontalRun = {
    y: number;
    xStart: number;
    xEnd: number;
};

export type VerticalRun = {
    x: number;
    yStart: number;
    yEnd: number;
};

export interface ExtractedImageOcrData {
    name: string;
    netArea: number;
    sharedArea: number;
    totalArea: number;
    verandaArea: number;
    rawText: string;
    confidence: number;
    metadata?: {
        pageCount?: number;
        extractionMethod: "text" | "ocr" | "mixed" | "ghostscript";
    };
}
