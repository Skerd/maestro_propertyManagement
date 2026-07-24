/**
 * AP OCR extraction (§3.N) — feature-flagged.
 *
 * Real OCR of a scanned invoice / QR-bill image requires an OCR toolkit and is
 * gated behind PM_AP_OCR_ENABLED. When disabled (default), extraction falls back
 * to manual entry: the operator fills the extracted* fields, or pastes the decoded
 * Swiss QR payload which is parsed deterministically by swissQrBill.ts.
 */

import {parseSwissQrBillPayload, SwissQrBillData} from "./swissQrBill";

export interface OcrExtractionResult {
    ocrStatus: "done" | "failed";
    fromQrBill: boolean;
    data: Partial<SwissQrBillData> & {invoiceNumber?: string; invoiceDate?: string; dueDate?: string};
}

export function isApOcrEnabled(): boolean {
    return process.env.PM_AP_OCR_ENABLED === "true" || process.env.PM_AP_OCR_ENABLED === "1";
}

/**
 * Extracts invoice fields. If a decoded Swiss QR payload is supplied, it is parsed
 * regardless of the OCR flag (deterministic). Otherwise, when OCR is disabled this
 * returns "failed" to signal the manual-entry fallback.
 */
export function extractIncomingInvoice(input: {qrPayload?: string}): OcrExtractionResult {
    if (input.qrPayload) {
        const qr = parseSwissQrBillPayload(input.qrPayload);
        if (qr.valid) {
            return {ocrStatus: "done", fromQrBill: true, data: qr};
        }
    }
    if (!isApOcrEnabled()) {
        return {ocrStatus: "failed", fromQrBill: false, data: {}};
    }
    // Image OCR toolkit would run here when enabled; not bundled — manual fallback.
    return {ocrStatus: "failed", fromQrBill: false, data: {}};
}
