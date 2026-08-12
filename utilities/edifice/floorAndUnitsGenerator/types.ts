export type PageImageResult = {
    pageNumber: number;
    outputPath: string;
    width: number;
    height: number;
    centerUnitPath?: string;
    floorPlanPath?: string;
    rectangleCount: number;
    rotationNeeded?: number;
    excludeRectangles?: Rectangle[];
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
     * When ORB+homography registration succeeds, the reference is the per-floor
     * master `floor-plan.png` so overlays map onto the full layout.
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
    /** Center + top-right plan rectangles only (detection space); used to filter PDF text. */
    excludeRectangles?: Rectangle[];
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

/**
 * 'other' is a page the layout heuristics called a floor or a unit but whose text
 * carries no evidence for it — cover renders, site-position and site-layout pages.
 * Those pages are excluded from the summary rather than becoming phantom floors.
 */
export type PageType = 'floor' | 'unit' | 'other';
export type TextExtractionMethod = 'poppler' | 'ghostscript';

export interface ExtractedImageOcrData {
    name: string;
    netArea: number;
    sharedArea: number;
    totalArea: number;
    verandaArea: number;
    rawText: string;
    confidence: number;
    /** Visual/OCR classification: master floor plan vs unit detail page. */
    type?: PageType;
    metadata?: {
        pageCount?: number;
        extractionMethod: TextExtractionMethod;
    };
}
