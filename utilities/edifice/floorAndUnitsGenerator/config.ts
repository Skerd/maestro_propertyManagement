export const config = {

    // batch turning PDF pages to images
    BATCH_PDF_PAGES_TO_IMAGES: 200, // how many pages of the PDF are turned into images in one go
    BATCH_PDF_PAGES_DPI: 100, // how good the quality of the PDF page is when batch turned into image

    // image processing
    OVERLAY_LINE_THICKNESS: 4,
    CROP_EDGE_INSET_PX: 4, // Pixels shaved from each side of rectangle crops after padding (0 = no inset)
    DETAIL_PDF_PAGES_DPI: 300, // Ghostscript `-r` for crop re-export.
    CROP_PADDING: 0,
    LINE_INK_THRESHOLD: 100, // darkens faded lines

    // rectangle processing
    RECT_MIN_WIDTH_RATIO: 0.20,         // minimum width of a rectangle
    RECT_MIN_HEIGHT_RATIO: 0.20,        // minimum height of a rectangle
    RECT_MAX_WIDTH_RATIO: 0.9999999,    // maximum width of a rectangle
    RECT_MAX_HEIGHT_RATIO: 0.99,        // maximum height of a rectangle
    RECT_DEDUP_TOLERANCE: 3,            // check if rectangles include each other with boundary match tolerance

    // line detection processing
    DARK_PIXEL_THRESHOLD: 65,   // Greyscale ≤ this (0–255) counts as ink when scanning / trimming H/V line runs
    HORIZONTAL_RUN_RATIO: 0.15, // Min horizontal run length as a fraction of image width (shorter dark runs are ignored).
    VERTICAL_RUN_RATIO: 0.15,   // Min vertical run length as a fraction of image height (shorter dark runs are ignored)
    LINE_SNAP_TOLERANCE: 20,    // Max px between H and V segments to treat as intersecting (corners, splits, rectangles)
    LINE_MERGE_TOLERANCE: 0,    // Max px |Δy| (horizontals) or |Δx| (verticals) to group as the same row/column before merging
    LINE_GAP_TOLERANCE: 20,     // Max px gap along a collinear run to join end-to-end into one longer segment
} as const;
