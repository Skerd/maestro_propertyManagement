export const config = {
    DEFAULT_SCALE: 1,
    DEFAULT_DPI: 50,

    HORIZONTAL_RUN_RATIO: 0.15,
    VERTICAL_RUN_RATIO: 0.15,
    RECT_MIN_WIDTH_RATIO: 0.20,
    RECT_MIN_HEIGHT_RATIO: 0.20,
    RECT_MAX_WIDTH_RATIO: 0.9999999,
    RECT_MAX_HEIGHT_RATIO: 0.99,
    RECT_DEDUP_TOLERANCE: 3,

    DARK_PIXEL_THRESHOLD: 65,
    OVERLAY_LINE_THICKNESS: 4,

    LINE_MERGE_TOLERANCE: 0,
    LINE_GAP_TOLERANCE: 20,
    LINE_SNAP_TOLERANCE: 20,
    MIN_LINE_THICKNESS: 0.01,
    CROP_PADDING: 0,

    /** Pixels shaved from each side of rectangle crops after padding (0 = no inset). */
    CROP_EDGE_INSET_PX: 4,

    /**
     * Re-rasterize the full PDF page at {@link CROP_DETAIL_RASTER_DPI}, then crop the same rectangles
     * (after matching rotation as the preview PNG). Much sharper for vector PDFs; high RAM use on large pages.
     */
    CROP_HIGH_DETAIL_FROM_PDF: true,
    /** Ghostscript `-r` for crop re-export. Preview raster uses `DEFAULT_DPI * DEFAULT_SCALE`. */
    CROP_DETAIL_RASTER_DPI: 300,

    // Image saving toggles - disable to skip saving and speed up processing
    SAVE_ORIGINAL_IMAGE: true,      // Save base rendered image (page-N.png)
    SAVE_BOOSTED_IMAGE: true,      // Save boosted contrast image (page-N-boosted.png)
    SAVE_LINES_OVERLAY: true,      // Save lines overlay image (page-N-lines.png)
    SAVE_RECTANGLES_OVERLAY: true, // Save rectangles overlay image (page-N-rectangles.png)
    SAVE_POLYGON_OVERLAY: true,    // Save polygon overlay image (floor-plan-polygon-overlay.png)


    /**
     * opencv4nodejs highlight extraction: save intermediate PNGs (BGR, HSV blur viz, raw mask, morph steps, final mask)
     * under each unit folder at `units/<slug>/highlight-debug/`. Off by default to avoid extra I/O.
     */
    SAVE_HIGHLIGHT_DEBUG_ARTIFACTS: true,
    // Text extraction method - 'pdf' is much faster (extracts embedded text), 'ocr' is slower but works on scanned PDFs
    TEXT_EXTRACTION_METHOD: 'pdf' as 'pdf' | 'ocr',
    /**
     * Fraction of min(width,height) cropped from each side before highlight polygon detection
     * to ignore decorative borders around floor plans.
     */
    POLYGON_DETECT_BORDER_INSET_FRACTION: 0.025,
    /**
     * opencv4nodejs: after HSV + morphology, distance-threshold → thick mask (08). When T>0 and 08 is non-empty,
     * 09 is **only** repeated 3×3 dilate of 08; iteration count is **round(T/2)** (min 1, max 64), still with no 07 clip.
     * 0 = disabled (contours run on morph mask before thickness step).
     */
    HIGHLIGHT_MASK_MIN_DISTANCE_TO_BACKGROUND_PX: 15,
    /**
     * After polygon extraction, rewrite each unit's saved floor-plan.png onto a canvas with the
     * same width/height ratio as the per-floor master floor-plan.png (letterboxed, no stretch).
     */
    UNIT_FLOOR_PLAN_MATCH_MASTER_ASPECT: true,
} as const;
