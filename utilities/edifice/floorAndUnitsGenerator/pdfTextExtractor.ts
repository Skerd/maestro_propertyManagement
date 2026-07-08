/**
 * PDF Text Extraction Utility
 * 
 * Extracts text content from PDF files using pdf-parse library.
 * Handles both text-based PDFs and provides fallback for image-based PDFs.
 */

import {serverLogger} from '@coreModule/loggers/serverLog';

// pdf-parse v2.4.5 uses PDFParse class
const {PDFParse} = require('pdf-parse');

export interface ExtractedText {
    text: string;
    pageCount: number;
    metadata: {
        title?: string;
        author?: string;
        subject?: string;
        creator?: string;
        producer?: string;
        creationDate?: Date;
        modDate?: Date;
    };
}

/**
 * Extracts text from a PDF buffer
 * 
 * @param pdfBuffer - PDF file as Buffer
 * @param pageNumber - Optional page number (0-indexed). If not provided, extracts from all pages
 * @param logger - Optional logger instance
 * @returns Promise resolving to extracted text and metadata
 */
export async function extractTextFromPdf(
    pdfBuffer: Buffer,
    pageNumber?: number,
    logger?: serverLogger
): Promise<ExtractedText> {
    const parser = new PDFParse({ data: pdfBuffer });
    
    try {
        // Get PDF info first
        const info = await parser.getInfo({ parsePageInfo: true });
        const pageCount = info.total || 0;
        
        logger?.debug(`PDF parsed: ${pageCount} pages`);
        
        // Extract text - if pageNumber specified, extract only that page
        let parseParams: any = {};
        if (pageNumber !== undefined && pageNumber >= 0 && pageNumber < pageCount) {
            // Extract specific page (1-based in PDFParse)
            parseParams = { partial: [{ first: pageNumber + 1, last: pageNumber + 1 }] };
            logger?.debug(`Extracting text from page ${pageNumber + 1} of ${pageCount}`);
        }
        
        const textResult = await parser.getText(parseParams);
        const text = textResult.text || '';
        
        logger?.debug(`Extracted ${text.length} characters from PDF`);

        return {
            text: text.trim(),
            pageCount: pageCount,
            metadata: {
                title: info.infoData?.Title,
                author: info.infoData?.Author,
                subject: info.infoData?.Subject,
                creator: info.infoData?.Creator,
                producer: info.infoData?.Producer,
                creationDate: info.infoData?.CreationDate ? new Date(info.infoData.CreationDate) : undefined,
                modDate: info.infoData?.ModDate ? new Date(info.infoData.ModDate) : undefined
            }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger?.err('Error extracting text from PDF', error);
        logger?.err(`Error details: ${errorMessage}`, errorStack ? {stack: errorStack} : {});
        throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
    } finally {
        // Always clean up
        try {
            await parser.destroy();
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}
