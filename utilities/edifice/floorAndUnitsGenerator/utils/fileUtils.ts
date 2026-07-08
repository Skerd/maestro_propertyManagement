import fs from 'fs';
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";

/**
 * Reads PDF file bytes from disk
 * @param pdfPath - Path to PDF file
 * @returns Buffer containing PDF bytes
 * @throws Error if PDF file doesn't exist
 */
export function readPdfBytes(pdfPath: string): Buffer {
    if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF not found at: ${pdfPath}`);
    }
    return fs.readFileSync(pdfPath);
}

/**
 * Converts a label string to a URL-friendly slug
 * @param value - Label string to slugify
 * @returns Slugified string
 */
export function slugifyLabel(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath - Path to directory
 * @param parentLogger - Parent logger instance
 */
export function ensureDir(dirPath: string, parentLogger: serverLogger): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
