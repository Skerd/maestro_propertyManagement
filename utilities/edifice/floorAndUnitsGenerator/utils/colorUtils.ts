export function hslToRgb(hue: number, saturation: number, lightness: number): { r: number; g: number; b: number } {
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 1/6) {
        r = c; g = x; b = 0;
    } else if (h < 2/6) {
        r = x; g = c; b = 0;
    } else if (h < 3/6) {
        r = 0; g = c; b = x;
    } else if (h < 4/6) {
        r = 0; g = x; b = c;
    } else if (h < 5/6) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

/**
 * Generates a distinct color for line overlays
 * @param index - Index to generate unique color
 * @returns Hex color string (e.g., "#ff0000")
 */
export function generateLineColor(index: number): string {
    const { r, g, b } = hslToRgb(
        (index * 137.508) % 360, // Golden angle approximation for better distribution
        70 + (index % 3) * 10, // Vary saturation between 70-90%
        50 + (index % 2) * 5 // Vary lightness between 50-55%
    );
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generates distinct colors for rectangle overlays
 * @param index - Index to generate unique color
 * @param total - Total number of rectangles (for potential future use)
 * @returns Object with stroke and fill color strings
 */
export function generateColorForIndex(index: number, total: number): { stroke: string; fill: string } {
    const { r, g, b } = hslToRgb(
        (index * 137.508) % 360, // Golden angle approximation for better distribution
        70 + (index % 3) * 10, // Vary saturation between 70-90%
        50 + (index % 2) * 5 // Vary lightness between 50-55%
    );
    const strokeColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    const fillColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
    return { stroke: strokeColor, fill: fillColor };
}
