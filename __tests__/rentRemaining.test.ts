import {describe, expect, it} from "vitest";
import {Decimal128} from "mongodb";
import {
    applyRentalPaymentSlice,
    decimal128FromNumber,
    isSettledRemaining,
    planFifoSlices,
    remainingNumber,
    remainingScaled,
    SETTLE_THRESHOLD_SCALED,
    sliceFitsRemaining,
} from "../utilities/lease/rentRemaining";

function d(n: string | number): Decimal128 {
    return typeof n === "number" ? decimal128FromNumber(n) : Decimal128.fromString(n);
}

describe("rentRemaining", () => {
    it("rounds remaining to 2 decimal places for the DTO", () => {
        const row = {amount: d("4000.00"), paidAmount: d("1999.994"), status: "partially_paid"};
        expect(remainingNumber(row)).toBe(2000.01);
    });

    it("treats remaining ≤ 0.005 as settled", () => {
        const almost = {amount: d("4000"), paidAmount: d("3999.995"), status: "partially_paid"};
        expect(isSettledRemaining(remainingScaled(almost))).toBe(true);
        expect(remainingNumber(almost)).toBe(0);

        const stillOpen = {amount: d("4000"), paidAmount: d("3999.994"), status: "partially_paid"};
        expect(isSettledRemaining(remainingScaled(stillOpen))).toBe(false);
        expect(SETTLE_THRESHOLD_SCALED).toBe(5n);
    });

    it("waived remaining is 0 even with unpaid amount", () => {
        expect(remainingNumber({amount: d("4000"), paidAmount: d("0"), status: "waived"})).toBe(0);
    });

    it("includes lateFeeAmount in remaining", () => {
        const row = {
            amount: d("4000"),
            paidAmount: d("2000"),
            lateFeeAmount: d("400"),
            status: "overdue",
        };
        expect(remainingNumber(row)).toBe(2400);
    });

    it("rejects a slice that does not fit remaining", () => {
        const row = {amount: d("4000"), paidAmount: d("2000"), status: "partially_paid"};
        expect(sliceFitsRemaining(row, d("2000.01"))).toBe(false);
        expect(applyRentalPaymentSlice(row, {paidAmount: d("2000.01"), paidDate: new Date()}).ok).toBe(false);
        const applied = applyRentalPaymentSlice(row, {paidAmount: d("2000"), paidDate: new Date()});
        expect(applied.ok).toBe(true);
        if (applied.ok) expect(applied.status).toBe("paid");
    });

    it("accumulates a partial slice and appends a receipt", () => {
        const row = {amount: d("4000"), paidAmount: d("0"), status: "pending", paymentReceipts: []};
        const applied = applyRentalPaymentSlice(row, {
            paidAmount: d("2000"),
            paidDate: new Date("2026-01-15T00:00:00.000Z"),
            notes: "first half",
        });
        expect(applied.ok).toBe(true);
        if (!applied.ok) return;
        expect(applied.status).toBe("partially_paid");
        expect(applied.paidDate).toBeUndefined();
        expect(applied.paymentReceipts).toHaveLength(1);
        expect(applied.paymentReceipts[0].notes).toBe("first half");
        expect(remainingNumber({...row, paidAmount: applied.paidAmount, status: applied.status})).toBe(2000);
    });

    it("allows a 0.005 overage as a fit and settles", () => {
        const row = {amount: d("4000"), paidAmount: d("0"), status: "pending"};
        expect(sliceFitsRemaining(row, d("4000.005"))).toBe(true);
        const applied = applyRentalPaymentSlice(row, {paidAmount: d("4000.005"), paidDate: new Date()});
        expect(applied.ok).toBe(true);
        if (applied.ok) expect(applied.status).toBe("paid");
    });
});

describe("planFifoSlices", () => {
    it("fills two months and leaves a 2000 remainder on the third", () => {
        const months = [
            {id: "jan", amount: d("4000"), paidAmount: d("0"), status: "pending"},
            {id: "feb", amount: d("4000"), paidAmount: d("0"), status: "pending"},
            {id: "mar", amount: d("4000"), paidAmount: d("0"), status: "pending"},
        ];
        const plan = planFifoSlices(months, d("10000"));
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(plan.slices).toHaveLength(3);
        expect(plan.slices[0].id).toBe("jan");
        expect(plan.slices[2].slice.toString()).toBe("2000.000");
    });

    it("rejects leftover after the full schedule", () => {
        const months = [
            {id: "jan", amount: d("4000"), paidAmount: d("0"), status: "pending"},
            {id: "feb", amount: d("4000"), paidAmount: d("0"), status: "pending"},
        ];
        const plan = planFifoSlices(months, d("8000.01"));
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.reason).toBe("exceeds_open_due");
        expect(plan.maxApplicable.toString()).toBe("8000.000");
    });

    it("treats leftover ≤ 0.005 after filling as settled", () => {
        const months = [{id: "jan", amount: d("4000"), paidAmount: d("0"), status: "pending"}];
        const plan = planFifoSlices(months, d("4000.005"));
        expect(plan.ok).toBe(true);
    });

    it("returns no_open_due when every month is settled", () => {
        const months = [{id: "jan", amount: d("4000"), paidAmount: d("4000"), status: "paid"}];
        const plan = planFifoSlices(months, d("100"));
        expect(plan.ok).toBe(false);
        if (!plan.ok) expect(plan.reason).toBe("no_open_due");
    });
});
