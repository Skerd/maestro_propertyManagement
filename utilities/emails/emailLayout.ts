import {EMAIL_FONT, escapeHtml, pushRow, type SummaryRow} from "@coreModule/utilities/emails/emailLayout";

/** Property-management parts of the email layout; the shared parts live in core. */

/** Project → edifice → floor, omitting any name that was not snapshotted. */
export function pushUnitLocationRows(
    rows: SummaryRow[],
    loc: Record<string, string>,
    location: {projectName?: string; edificeName?: string; floorName?: string}
): void {
    pushRow(rows, loc.labelProject, location.projectName);
    pushRow(rows, loc.labelEdifice, location.edificeName);
    pushRow(rows, loc.labelFloor, location.floorName);
}

export type ScheduleTableRow = {
    installmentNumber: number;
    dueDate: string;
    amount: string;
    principal?: string;
    interest?: string;
};

/**
 * Payment-plan installment table (sale confirmation + staff sale alert). Principal / interest
 * columns appear only when the rows carry them. `loc` keys: `scheduleTitle`, `colInstallment`,
 * `colDueDate`, `colAmount`, `colPrincipal`, `colInterest`.
 */
export function scheduleTableHtml(loc: Record<string, string>, rows: ScheduleTableRow[] | undefined): string {
    if (!rows?.length) {
        return "";
    }
    const withSplit = rows.some(r => r.principal != null || r.interest != null);
    const headers = [loc.colInstallment, loc.colDueDate, ...(withSplit ? [loc.colPrincipal, loc.colInterest] : []), loc.colAmount];
    const cell = (text: string, opts: {head?: boolean; right?: boolean; border?: boolean}) =>
        `<td style="padding:${opts.head ? "10px 8px" : "9px 8px"};${opts.border ? "border-bottom:1px solid #f2f3f5;" : ""}font-family:${EMAIL_FONT};font-size:${
            opts.head ? "11px" : "13px"
        };font-weight:${opts.head ? 600 : opts.right ? 600 : 400};${opts.head ? "letter-spacing:0.04em;text-transform:uppercase;" : ""}line-height:150%;color:${
            opts.head ? "#9aa0a8" : "#111114"
        };text-align:${opts.right ? "right" : "left"};white-space:nowrap;">${escapeHtml(text)}</td>`;

    const headHtml = `<tr>${headers.map((h, i) => cell(h ?? "", {head: true, right: i >= 2, border: true})).join("")}</tr>`;
    const bodyHtml = rows
        .map((r, index) => {
            const border = index !== rows.length - 1;
            const values = [`#${r.installmentNumber}`, r.dueDate, ...(withSplit ? [r.principal ?? "", r.interest ?? ""] : []), r.amount];
            return `<tr>${values.map((v, i) => cell(v, {right: i >= 2, border})).join("")}</tr>`;
        })
        .join("");

    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr>
    <td style="padding:24px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #eceef1;border-radius:10px;">
        <tr>
          <td bgcolor="#f7f8fa" style="background-color:#f7f8fa;border-radius:10px 10px 0 0;padding:14px 20px;font-family:${EMAIL_FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;line-height:150%;color:#9aa0a8;">${escapeHtml(
        loc.scheduleTitle ?? ""
    )}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 12px;">
            <div style="overflow-x:auto;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">${headHtml}${bodyHtml}</table>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
