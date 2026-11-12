/** UX-12: the inspection list's "When" quick filter compares the stored inspection day with the company's today (GLB-09). */
import {describe, expect, it} from "vitest";
import {inspectionWhenCondition} from "@propertyManagement/utilities/inspection/inspectionWhen";

describe("inspection \"When\" quick filter", () => {
    it("upcoming starts on today", () => {
        expect(inspectionWhenCondition("upcoming", "2026-11-12")).toEqual({inspectionDate: {$gte: "2026-11-12"}});
    });

    it("today is the company's day only", () => {
        expect(inspectionWhenCondition("today", "2026-11-12")).toEqual({inspectionDate: "2026-11-12"});
    });

    it("past is any day before today", () => {
        expect(inspectionWhenCondition("past", "2026-11-12")).toEqual({inspectionDate: {$lt: "2026-11-12"}});
    });
});
