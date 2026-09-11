export const config = {

    // batch turning PDF pages to images
    BATCH_PDF_PAGES_TO_IMAGES: 200,     // how many pages of the PDF are turned into images in one go
    BATCH_PDF_PAGES_DPI: 100,           // how good the quality of the PDF page is when batch turned into image

    // image processing
    OVERLAY_LINE_THICKNESS: 4,
    CROP_EDGE_INSET_PX: 4,              // Pixels shaved from each side of rectangle crops after padding (0 = no inset)
    // Detail crops are resized to this height (width scales). Replaces a fixed DPI so
    // large CAD sheets do not become 9k-wide rasters. ORB also loads floor masters at
    // this height so DB-reused old images match current unit schematics.
    DETAIL_PDF_PAGE_TARGET_HEIGHT_PX: 3200,
    CROP_PADDING: 0,
    LINE_INK_THRESHOLD: 100,            // darkens faded lines

    // rectangle processing
    RECT_MIN_WIDTH_RATIO: 0.20,         // minimum width of a rectangle
    RECT_MIN_HEIGHT_RATIO: 0.20,        // minimum height of a rectangle
    RECT_MAX_WIDTH_RATIO: 0.99,         // maximum width of a rectangle
    RECT_MAX_HEIGHT_RATIO: 0.99,        // maximum height of a rectangle
    RECT_DEDUP_TOLERANCE: 3,            // check if rectangles include each other with boundary match tolerance

    // Old CAD sheets (title-block header + footer). Used only when oldPdf is set.
    OLD_PDF_PAGE_FRAME_WIDTH_RATIO: 0.90,   // sheet frame covers at least this of the page width
    OLD_PDF_PAGE_FRAME_HEIGHT_RATIO: 0.75,  // sheet frame covers at least this of the page height (header+plan+footer)
    OLD_PDF_TITLE_BLOCK_BAND_RATIO: 0.18,   // search for header/footer separator lines in this fraction of the sheet
    OLD_PDF_FULL_WIDTH_LINE_RATIO: 0.60,    // min fraction of sheet width for a title-block separator
    OLD_PDF_MIN_INNER_AREA_RATIO: 0.25,     // inner plan rectangle must cover at least this of the page
    OLD_PDF_FALLBACK_INSET_RATIO: 0.08,     // crop inset from the sheet when no separator line is found
    OLD_PDF_TOP_RIGHT_MIN_CENTER_X_RATIO: 0.55, // position thumbnail sits on the right side
    OLD_PDF_TOP_RIGHT_MAX_TOP_RATIO: 0.45,      // position thumbnail starts in the upper half
    OLD_PDF_TOP_RIGHT_MAX_HEIGHT_RATIO: 0.50,   // reject a stacked right-column (position+photo+table)
    OLD_PDF_TOP_RIGHT_MAX_WIDTH_RATIO: 0.50,    // reject the main unit plan
    OLD_PDF_RIGHT_COLUMN_MIN_WIDTH_RATIO: 0.10, // unit pages leave a POZICIONI column; floor plans fill the sheet
    OLD_PDF_DARK_BLOCK_MIN_HEIGHT_RATIO: 0.08,  // photo-sized dark fill, not a thick wall
    OLD_PDF_DARK_BLOCK_MIN_WIDTH_RATIO: 0.10,   // right-column photo is ~25% of page; 15% page-run misses gappy tops
    OLD_PDF_DARK_BLOCK_LIGHT_THRESHOLD: 140,    // paper above/below a boosted photo (grey ramps fail DARK_PIXEL_THRESHOLD)

    // line detection processing
    DARK_PIXEL_THRESHOLD: 65,           // Greyscale ≤ this (0–255) counts as ink when scanning / trimming H/V line runs
    HORIZONTAL_RUN_RATIO: 0.15,         // Min horizontal run length as a fraction of image width (shorter dark runs are ignored).
    VERTICAL_RUN_RATIO: 0.15,           // Min vertical run length as a fraction of image height (shorter dark runs are ignored)
    LINE_SNAP_TOLERANCE: 20,            // Max px between H and V segments to treat as intersecting (corners, splits, rectangles)
    LINE_MERGE_TOLERANCE: 0,            // Max px |Δy| (horizontals) or |Δx| (verticals) to group as the same row/column before merging
    LINE_GAP_TOLERANCE: 20,             // Max px gap along a collinear run to join end-to-end into one longer segment
} as const;
