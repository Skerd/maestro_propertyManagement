import {Decimal128, ObjectId} from "mongodb";
import {fromMinor, minorToNumber, percentOfMinor, toMinor} from "armonia/src/modules/core/helpers/money";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";

/** Internal scale: 3 decimal places (armonia's money helper at 3 decimals, D35). Remaining ≤ 0.005 is settled. */
const SCALE = 3;
export const SETTLE_THRESHOLD_SCALED = 5n;

export const OPEN_RENT_STATUSES = ["pending", "overdue", "partially_paid"] as const;
export type OpenRentStatus = (typeof OPEN_RENT_STATUSES)[number];

export type RentMoneyRow = {
    amount: Decimal128 | string | number | null | undefined;
    paidAmount?: Decimal128 | string | number | null;
    lateFeeAmount?: Decimal128 | string | number | null;
    status?: string | null;
    paymentReceipts?: {amount?: unknown; paidDate?: Date; notes?: string; media?: ReadonlyArray<unknown>}[] | null;
};

export type RentalPaymentReceiptWrite = {
    amount: Decimal128;
    paidDate: Date;
    notes?: string;
    media?: ObjectId[];
};

export type ApplySliceOk = {
    ok: true;
    paidAmount: Decimal128;
    status: "paid" | "partially_paid";
    paidDate?: Date;
    paymentReceipts: RentalPaymentReceiptWrite[];
};

export type ApplySliceFail = {
    ok: false;
    reason: "overpay" | "not_open";
};

export type FifoMonth = RentMoneyRow & {id: string};

export type FifoPlanOk = {
    ok: true;
    slices: {id: string; slice: Decimal128}[];
};

export type FifoPlanFail = {
    ok: false;
    reason: "no_open_due" | "exceeds_open_due";
    maxApplicable: Decimal128;
};

export function isOpenRentStatus(status: string | null | undefined): status is OpenRentStatus {
    return status === "pending" || status === "overdue" || status === "partially_paid";
}

export function moneyToScaled(value: Decimal128 | string | number | null | undefined): bigint {
    if (value == null) return 0n;
    if (typeof value === "number" && !Number.isFinite(value)) return 0n;
    const text = String(value).trim();
    // Stored amounts may be empty or a Decimal128 NaN: they count as nothing, as they always have.
    if (text === "" || text === "NaN") return 0n;
    return toMinor(text, SCALE);
}

export function decimal128FromNumber(n: number): Decimal128 {
    return scaledToDecimal128(moneyToScaled(n));
}

export function scaledToDecimal128(scaled: bigint): Decimal128 {
    return decimal128FromMinor(scaled, SCALE);
}

/** A 3-decimal amount as a cent-rounded number for DTOs, rounded once. */
function scaledToNumber(scaled: bigint): number {
    return minorToNumber(toMinor(fromMinor(scaled, SCALE)));
}

export function isSettledRemaining(remainingScaled: bigint): boolean {
    return remainingScaled <= SETTLE_THRESHOLD_SCALED;
}

export function remainingScaled(row: RentMoneyRow): bigint {
    if (row.status === "waived") return 0n;
    const rem = moneyToScaled(row.amount) + moneyToScaled(row.lateFeeAmount) - moneyToScaled(row.paidAmount);
    return rem < 0n ? 0n : rem;
}

/** DTO remaining: waived/settled → 0, otherwise rounded to 2 decimal places. */
export function remainingNumber(row: RentMoneyRow): number {
    const rem = remainingScaled(row);
    if (isSettledRemaining(rem)) return 0;
    return scaledToNumber(rem);
}

export function moneyNumber(value: Decimal128 | string | number | null | undefined): number {
    const scaled = moneyToScaled(value);
    if (scaled === 0n) return 0;
    return scaledToNumber(scaled);
}

export function paidAmountNumber(row: RentMoneyRow): number | undefined {
    if (row.paidAmount == null) return undefined;
    return moneyNumber(row.paidAmount);
}

export function lateFeeNumber(row: RentMoneyRow): number | undefined {
    if (row.lateFeeAmount == null) return undefined;
    return moneyNumber(row.lateFeeAmount);
}

export function hasCollectedCash(row: RentMoneyRow): boolean {
    if (moneyToScaled(row.paidAmount) > SETTLE_THRESHOLD_SCALED) return true;
    return Array.isArray(row.paymentReceipts) && row.paymentReceipts.length > 0;
}

export function lateFeeFromPercentage(amount: Decimal128 | string | number, percentage: number): Decimal128 {
    return scaledToDecimal128(percentOfMinor(moneyToScaled(amount), percentage));
}

export function sliceFitsRemaining(row: RentMoneyRow, slice: Decimal128 | string | number): boolean {
    const sliceScaled = moneyToScaled(slice);
    if (sliceScaled <= 0n) return false;
    return sliceScaled <= remainingScaled(row) + SETTLE_THRESHOLD_SCALED;
}

export function applyRentalPaymentSlice(
    row: RentMoneyRow,
    slice: {paidAmount: Decimal128 | string | number; paidDate: Date; notes?: string; media?: string[]},
): ApplySliceOk | ApplySliceFail {
    if (row.status === "paid" || row.status === "waived") {
        return {ok: false, reason: "not_open"};
    }
    if (!sliceFitsRemaining(row, slice.paidAmount)) {
        return {ok: false, reason: "overpay"};
    }

    const sliceScaled = moneyToScaled(slice.paidAmount);
    const newPaidScaled = moneyToScaled(row.paidAmount) + sliceScaled;
    const newPaid = scaledToDecimal128(newPaidScaled);
    const receipts: RentalPaymentReceiptWrite[] = Array.isArray(row.paymentReceipts)
        ? row.paymentReceipts.map((r) => ({
            amount: r.amount instanceof Decimal128 ? r.amount : scaledToDecimal128(moneyToScaled(r.amount as Decimal128 | string | number | null | undefined)),
            paidDate: r.paidDate instanceof Date ? r.paidDate : new Date(),
            ...(typeof r.notes === "string" && r.notes !== "" ? {notes: r.notes} : {}),
            ...(r.media?.length ? {media: r.media.map(mediaItemToObjectId)} : {}),
        }))
        : [];
    const receipt: RentalPaymentReceiptWrite = {
        amount: scaledToDecimal128(sliceScaled),
        paidDate: slice.paidDate,
        ...(slice.notes != null && slice.notes !== "" ? {notes: slice.notes} : {}),
        ...(slice.media?.length ? {media: slice.media.map((id) => new ObjectId(id))} : {}),
    };
    receipts.push(receipt);

    const after: RentMoneyRow = {
        amount: row.amount,
        paidAmount: newPaid,
        lateFeeAmount: row.lateFeeAmount,
        status: row.status,
    };
    const rem = remainingScaled(after);
    if (isSettledRemaining(rem)) {
        return {
            ok: true,
            paidAmount: newPaid,
            status: "paid",
            paidDate: slice.paidDate,
            paymentReceipts: receipts,
        };
    }
    return {
        ok: true,
        paidAmount: newPaid,
        status: "partially_paid",
        paymentReceipts: receipts,
    };
}

export function planFifoSlices(months: FifoMonth[], lump: Decimal128 | string | number): FifoPlanOk | FifoPlanFail {
    const open = months.filter((m) => isOpenRentStatus(m.status) && !isSettledRemaining(remainingScaled(m)));
    if (open.length === 0) {
        return {ok: false, reason: "no_open_due", maxApplicable: scaledToDecimal128(0n)};
    }

    let totalOpen = 0n;
    for (const month of open) {
        totalOpen += remainingScaled(month);
    }
    const maxApplicable = scaledToDecimal128(totalOpen);

    let left = moneyToScaled(lump);
    if (left <= 0n) {
        return {ok: false, reason: "no_open_due", maxApplicable};
    }
    if (left > totalOpen + SETTLE_THRESHOLD_SCALED) {
        return {ok: false, reason: "exceeds_open_due", maxApplicable};
    }

    const slices: {id: string; slice: Decimal128}[] = [];
    for (const month of open) {
        if (isSettledRemaining(left)) break;
        const due = remainingScaled(month);
        if (isSettledRemaining(due)) continue;
        const take = left < due ? left : due;
        slices.push({id: month.id, slice: scaledToDecimal128(take)});
        left -= take;
    }

    if (!isSettledRemaining(left)) {
        return {ok: false, reason: "exceeds_open_due", maxApplicable};
    }

    return {ok: true, slices};
}

function mediaItemToObjectId(item: unknown): ObjectId {
    if (typeof item === "object" && item !== null && "_id" in item && !("_bsontype" in item)) {
        return new ObjectId(String(item._id));
    }
    return new ObjectId(String(item));
}
