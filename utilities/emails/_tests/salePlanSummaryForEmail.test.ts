import {describe, expect, it, vi} from "vitest";

vi.mock("@propertyManagement/database/schemas/paymentPlan/paymentPlan.service", () => ({paymentPlanService: {findOne: vi.fn()}}));

import {buildPaymentScheduleForEmail} from "../salePlanSummaryForEmail";
import {scheduleTableHtml} from "../emailLayout";

const loc = {
    scheduleTitle: "Payment schedule",
    colInstallment: "Installment",
    colDueDate: "Due date",
    colAmount: "Amount",
    colPrincipal: "Principal",
    colInterest: "Interest",
};

describe("buildPaymentScheduleForEmail", () => {
    it("sorts by installment number and omits principal/interest without interest", () => {
        const rows = buildPaymentScheduleForEmail(
            [
                {installmentNumber: 2, dueDate: "2027-02-01T00:00:00Z", amount: "500", principalAmount: "500", interestAmount: "0"},
                {installmentNumber: 1, dueDate: "2027-01-01T00:00:00Z", amount: "500", principalAmount: "500", interestAmount: "0"},
            ],
            "€",
            "en-US",
        );
        expect(rows.map(r => r.installmentNumber)).toEqual([1, 2]);
        expect(rows[0].amount).toContain("€");
        expect(rows[0].principal).toBeUndefined();
        expect(rows[0].dueDate).toMatch(/2027/);
    });

    it("adds principal and interest to every row when the plan carries interest", () => {
        const rows = buildPaymentScheduleForEmail(
            [
                {installmentNumber: 1, dueDate: "2027-01-01T00:00:00Z", amount: "510", principalAmount: "500", interestAmount: "10"},
                {installmentNumber: 2, dueDate: "2027-02-01T00:00:00Z", amount: "500", principalAmount: "500", interestAmount: "0"},
            ],
            undefined,
            "en-US",
        );
        expect(rows.every(r => r.principal != null && r.interest != null)).toBe(true);
    });
});

describe("scheduleTableHtml", () => {
    it("renders nothing without rows", () => {
        expect(scheduleTableHtml(loc, [])).toBe("");
        expect(scheduleTableHtml(loc, undefined)).toBe("");
    });

    it("renders one row per installment, with split columns only when present", () => {
        const plain = scheduleTableHtml(loc, [
            {installmentNumber: 1, dueDate: "Jan 1", amount: "500 €"},
            {installmentNumber: 2, dueDate: "Feb 1", amount: "500 €"},
        ]);
        expect(plain).toContain("Payment schedule");
        expect(plain).toContain("#2");
        expect(plain).not.toContain("Principal");

        const split = scheduleTableHtml(loc, [{installmentNumber: 1, dueDate: "Jan 1", amount: "510", principal: "500", interest: "10"}]);
        expect(split).toContain("Principal");
        expect(split).toContain("Interest");
    });

    it("escapes cell values", () => {
        expect(scheduleTableHtml(loc, [{installmentNumber: 1, dueDate: "<b>", amount: "1"}])).toContain("&lt;b&gt;");
    });
});
