/**
 * Swiss QR-bill (QR-Rechnung) payload parser — deterministic, no ML.
 *
 * Parses the newline-delimited "Swiss Payments Code" (SPC) text that is encoded
 * in a Swiss QR-bill's QR code into structured fields. Decoding the QR image
 * itself into this text is the OCR/scan step (see ocrExtract.ts, feature-flagged);
 * this parser turns that text into IncomingInvoice.extracted* fields.
 *
 * Field order follows the Swiss Implementation Guidelines QR-bill v2.0 (SPC / 0200).
 */

export interface SwissQrBillData {
    valid: boolean;
    iban?: string;
    creditorName?: string;
    amount?: number;
    currency?: string;       // ISO code e.g. CHF / EUR
    referenceType?: string;  // QRR | SCOR | NON
    reference?: string;
    unstructuredMessage?: string;
    debtorName?: string;
}

function line(parts: string[], i: number): string | undefined {
    const v = parts[i];
    return v == null || v === "" ? undefined : v.trim();
}

export function parseSwissQrBillPayload(payload: string): SwissQrBillData {
    if (!payload || typeof payload !== "string") return {valid: false};
    // Swiss QR payloads use CRLF or LF line breaks.
    const parts = payload.replace(/\r\n/g, "\n").split("\n");
    if (line(parts, 0) !== "SPC") return {valid: false};

    const amountRaw = line(parts, 18);
    const amount = amountRaw != null && amountRaw !== "" && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : undefined;

    return {
        valid: true,
        iban: line(parts, 3),
        creditorName: line(parts, 5),
        amount,
        currency: line(parts, 19),
        // Ultimate debtor name sits at index 21 in the v2.0 layout.
        debtorName: line(parts, 21),
        referenceType: line(parts, 27),
        reference: line(parts, 28),
        unstructuredMessage: line(parts, 29),
    };
}
