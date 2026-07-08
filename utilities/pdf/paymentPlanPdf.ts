import {PDFDocument, PDFFont, PDFPage, StandardFonts, rgb} from "pdf-lib";
import type {PaymentPlan, PaymentPlanInstallment} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/paymentPlan.dto";

const COLOR_PRIMARY   = rgb(0.12, 0.28, 0.53);
const COLOR_HEADER_BG = rgb(0.12, 0.28, 0.53);
const COLOR_ALT_ROW   = rgb(0.95, 0.96, 0.98);
const COLOR_WHITE     = rgb(1, 1, 1);
const COLOR_TEXT      = rgb(0.1, 0.1, 0.1);
const COLOR_MUTED     = rgb(0.45, 0.45, 0.45);
const COLOR_BORDER    = rgb(0.8, 0.82, 0.85);
const COLOR_PAID      = rgb(0.1, 0.55, 0.3);
const COLOR_OVERDUE   = rgb(0.75, 0.15, 0.15);

function fmtDate(iso: string | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {day: "2-digit", month: "short", year: "numeric"});
}

function fmtMoney(amount: number | undefined, symbol?: string): string {
    if (amount == null) return "—";
    const formatted = amount.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return symbol ? `${symbol} ${formatted}` : formatted;
}

function statusLabel(status: string): {text: string; color: readonly [number, number, number]} {
    switch (status?.toLowerCase()) {
        case "paid":     return {text: "Paid",    color: [0.1, 0.55, 0.3]};
        case "overdue":  return {text: "Overdue", color: [0.75, 0.15, 0.15]};
        case "pending":  return {text: "Pending", color: [0.45, 0.45, 0.45]};
        default:         return {text: status ?? "—", color: [0.45, 0.45, 0.45]};
    }
}

function drawText(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    colorRgb: ReturnType<typeof rgb> = COLOR_TEXT,
) {
    page.drawText(String(text ?? ""), {x, y, size, font, color: colorRgb});
}

function drawRect(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor: ReturnType<typeof rgb>,
    borderColor?: ReturnType<typeof rgb>,
) {
    page.drawRectangle({x, y, width: w, height: h, color: fillColor, ...(borderColor ? {borderColor, borderWidth: 0.5} : {})});
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
    let str = String(text ?? "");
    const ellipsis = "...";
    let width = font.widthOfTextAtSize(str, size);
    if (width <= maxWidth) return str;
    while (str.length > 0 && font.widthOfTextAtSize(str + ellipsis, size) > maxWidth) {
        str = str.slice(0, -1);
    }
    return str + ellipsis;
}

interface PdfContext {
    doc: PDFDocument;
    bold: PDFFont;
    regular: PDFFont;
    marginLeft: number;
    marginRight: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
}

function addPage(ctx: PdfContext): PDFPage {
    return ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
}

export async function generatePaymentPlanPdf(plan: PaymentPlan, companyName?: string): Promise<Uint8Array> {
    const doc     = await PDFDocument.create();
    const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);

    const pageWidth   = 595;  // A4 portrait
    const pageHeight  = 842;
    const marginLeft  = 40;
    const marginRight = 40;
    const contentWidth = pageWidth - marginLeft - marginRight;

    const ctx: PdfContext = {doc, bold, regular, marginLeft, marginRight, pageWidth, pageHeight, contentWidth};

    const currency  = plan.saleCurrency?.symbol ?? plan.saleCurrency?.abbreviation ?? "";
    const allInstallments = plan.installments ?? [];

    // ── Header ────────────────────────────────────────────────────────────────
    let page   = addPage(ctx);
    let cursorY = pageHeight - 30;

    // Blue header banner
    drawRect(page, 0, pageHeight - 70, pageWidth, 70, COLOR_HEADER_BG);
    drawText(page, companyName ?? "Real Estate", marginLeft, pageHeight - 28, bold, 14, COLOR_WHITE);
    drawText(page, "Payment Schedule", marginLeft, pageHeight - 50, regular, 11, rgb(0.8, 0.88, 0.98));
    drawText(page, `Ref: ${plan.name ?? plan._id}`, pageWidth - marginRight - 110, pageHeight - 44, regular, 9, rgb(0.8, 0.88, 0.98));
    cursorY = pageHeight - 90;

    // ── Summary section ───────────────────────────────────────────────────────
    drawText(page, "Plan Summary", marginLeft, cursorY, bold, 11, COLOR_PRIMARY);
    cursorY -= 16;
    drawRect(page, marginLeft, cursorY - 4, contentWidth, 0.5, COLOR_BORDER);
    cursorY -= 14;

    const summaryFields: [string, string][] = [
        ["Status",             plan.status ?? "—"],
        ["Total Amount",       fmtMoney(plan.totalAmount, currency)],
        ["Down Payment",       fmtMoney(plan.downPayment, currency)],
        ["Remaining Balance",  fmtMoney(plan.remainingBalance, currency)],
        ["# Installments",     String(plan.numberOfInstallments ?? "—")],
        ["Installment Amount", fmtMoney(plan.installmentAmount, currency)],
        ["Interest Rate",      plan.interestRate != null ? `${plan.interestRate}%` : "—"],
        ["Start Date",         fmtDate(plan.startDate)],
        ["End Date",           fmtDate(plan.endDate)],
        ["Down Payment Paid",  plan.downPaymentPaid ? "Yes" : "No"],
        ...(plan.downPaymentDate ? [["Down Payment Date", fmtDate(plan.downPaymentDate)] as [string, string]] : []),
    ];

    const halfW     = contentWidth / 2 - 10;
    const colRight  = marginLeft + contentWidth / 2 + 10;
    for (let i = 0; i < summaryFields.length; i++) {
        const col = i % 2 === 0 ? marginLeft : colRight;
        const [label, value] = summaryFields[i];
        drawText(page, label + ":", col, cursorY, regular, 8.5, COLOR_MUTED);
        drawText(page, value, col + 115, cursorY, bold, 8.5, COLOR_TEXT);
        if (i % 2 === 1) cursorY -= 14;
    }
    if (summaryFields.length % 2 === 1) cursorY -= 14;

    // Sale reference
    if (plan.sale?._id || (plan.sale as any)?.name) {
        cursorY -= 6;
        drawText(page, "Sale Ref:", marginLeft, cursorY, regular, 8.5, COLOR_MUTED);
        const saleName = (plan.sale as any)?.name ?? plan.sale?._id ?? "—";
        drawText(page, saleName, marginLeft + 115, cursorY, bold, 8.5, COLOR_TEXT);
        cursorY -= 14;
    }

    cursorY -= 16;

    // ── Installments table ────────────────────────────────────────────────────
    const cols = [
        {label: "#",         width: 28,  align: "right" as const},
        {label: "Due Date",  width: 72,  align: "left"  as const},
        {label: "Amount",    width: 80,  align: "right" as const},
        {label: "Principal", width: 72,  align: "right" as const},
        {label: "Interest",  width: 65,  align: "right" as const},
        {label: "Status",    width: 60,  align: "left"  as const},
        {label: "Paid",      width: 72,  align: "right" as const},
    ];

    const rowH  = 16;
    const hdrH  = 18;

    function drawTableHeader(p: PDFPage, y: number) {
        drawRect(p, marginLeft, y - hdrH + 4, contentWidth, hdrH, COLOR_HEADER_BG);
        let x = marginLeft + 4;
        for (const col of cols) {
            const textX = col.align === "right" ? x + col.width - 4 - bold.widthOfTextAtSize(col.label, 8) : x + 2;
            drawText(p, col.label, textX, y - 10, bold, 8, COLOR_WHITE);
            x += col.width;
        }
    }

    function drawInstallmentRow(p: PDFPage, inst: PaymentPlanInstallment, y: number, isAlt: boolean) {
        if (isAlt) drawRect(p, marginLeft, y - rowH + 4, contentWidth, rowH, COLOR_ALT_ROW);

        const {text: statusText, color: statusColorArr} = statusLabel(inst.status);
        const statusColor = rgb(statusColorArr[0], statusColorArr[1], statusColorArr[2]);

        const values = [
            String(inst.installmentNumber),
            fmtDate(inst.dueDate),
            fmtMoney(inst.amount, currency),
            fmtMoney(inst.principalAmount, currency),
            fmtMoney(inst.interestAmount, currency),
            statusText,
            inst.paidAmount != null ? fmtMoney(inst.paidAmount, currency) : "—",
        ];

        let x = marginLeft + 4;
        for (let ci = 0; ci < cols.length; ci++) {
            const col   = cols[ci];
            const val   = truncate(values[ci], regular, 7.5, col.width - 6);
            const color = ci === 5 ? statusColor : COLOR_TEXT;
            const textX = col.align === "right" ? x + col.width - 4 - regular.widthOfTextAtSize(val, 7.5) : x + 2;
            drawText(p, val, textX, y - 9, regular, 7.5, color);
            x += col.width;
        }

        // bottom border line
        drawRect(p, marginLeft, y - rowH + 4, contentWidth, 0.4, COLOR_BORDER);
    }

    // First page table header
    drawText(page, "Installment Schedule", marginLeft, cursorY, bold, 11, COLOR_PRIMARY);
    cursorY -= 16;
    drawTableHeader(page, cursorY);
    cursorY -= hdrH;

    for (let i = 0; i < allInstallments.length; i++) {
        if (cursorY - rowH < 50) {
            // Start new page
            page    = addPage(ctx);
            cursorY = pageHeight - 30;
            drawTableHeader(page, cursorY);
            cursorY -= hdrH;
        }
        drawInstallmentRow(page, allInstallments[i], cursorY, i % 2 === 1);
        cursorY -= rowH;
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const pages = doc.getPages();
    const total = pages.length;
    for (let pi = 0; pi < total; pi++) {
        const p = pages[pi];
        drawRect(p, 0, 0, pageWidth, 22, rgb(0.94, 0.95, 0.97));
        drawText(p, `Generated ${new Date().toLocaleDateString("en-GB")}`, marginLeft, 8, regular, 7, COLOR_MUTED);
        const pageNum = `Page ${pi + 1} / ${total}`;
        drawText(p, pageNum, pageWidth - marginRight - bold.widthOfTextAtSize(pageNum, 7), 8, regular, 7, COLOR_MUTED);
    }

    return doc.save();
}
