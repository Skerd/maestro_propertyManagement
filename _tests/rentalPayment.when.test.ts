/** UX-12: the rental payment list's "When" quick filter compares the stored due day with the company's today (GLB-09). */
import {describe, expect, it} from "vitest";
import {rentalPaymentWhenCondition} from "@propertyManagement/utilities/lease/rentalPaymentSchedule";

describe("rental payment \"When\" quick filter", () => {
    it("upcoming starts on today", () => {
        expect(rentalPaymentWhenCondition("upcoming", "2026-11-12")).toEqual({dueDate: {$gte: "2026-11-12"}});
    });

    it("overdue is a day before today that is still open, whatever the daily job has stamped", () => {
        expect(rentalPaymentWhenCondition("overdue", "2026-11-12")).toEqual({
            dueDate: {$lt: "2026-11-12"},
            status: {$in: ["pending", "overdue", "partially_paid"]},
        });
    });

    it("past is any day before today, paid and waived included", () => {
        expect(rentalPaymentWhenCondition("past", "2026-11-12")).toEqual({dueDate: {$lt: "2026-11-12"}});
    });
});
