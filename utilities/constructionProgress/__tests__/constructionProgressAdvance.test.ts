import {describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const mocks = vi.hoisted(() => ({reports: [] as any[]}));

vi.mock("@propertyManagement/database/schemas/constructionProgress/constructionProgress", () => ({
    default: {
        // Mimics findOne(filter).sort({updateDate:-1, createdAt:-1}).session(): newest match wins.
        findOne: (filter: any) => ({
            sort: () => ({
                session: async () => {
                    const rows = mocks.reports.filter(r =>
                        String(r.project) === String(filter.project)
                        && (!filter.edifice || String(r.edifice) === String(filter.edifice))
                        && (!filter._id || String(r._id) !== String(filter._id.$ne)));
                    rows.sort((a, b) => b.updateDate - a.updateDate || b.createdAt - a.createdAt);
                    return rows[0] ?? null;
                },
            }),
        }),
    },
}));

import {findLatestConstructionProgress, isConstructionAdvance} from "../constructionProgressAdvance";

const company = new ObjectId();
const project = new ObjectId();
const edifice = new ObjectId();

function report(o: Partial<any>) {
    return {_id: new ObjectId(), project, phase: "structure", progressPercent: 40, updateDate: new Date("2027-01-01"), createdAt: new Date("2027-01-01"), ...o};
}

describe("isConstructionAdvance", () => {
    it("treats the first report as an advance", () => {
        expect(isConstructionAdvance(null, {phase: "foundations", progressPercent: 10})).toBe(true);
    });
    it("advances on a later phase even with a lower %", () => {
        expect(isConstructionAdvance({phase: "structure", progressPercent: 60}, {phase: "envelope", progressPercent: 55})).toBe(true);
    });
    it("advances on a higher % in the same phase", () => {
        expect(isConstructionAdvance({phase: "structure", progressPercent: 60}, {phase: "structure", progressPercent: 75})).toBe(true);
    });
    it("does not advance on equal or lower progress, or an earlier phase", () => {
        expect(isConstructionAdvance({phase: "structure", progressPercent: 60}, {phase: "structure", progressPercent: 60})).toBe(false);
        expect(isConstructionAdvance({phase: "structure", progressPercent: 60}, {phase: "structure", progressPercent: 50})).toBe(false);
        expect(isConstructionAdvance({phase: "envelope", progressPercent: 10}, {phase: "structure", progressPercent: 90})).toBe(false);
    });
});

describe("findLatestConstructionProgress", () => {
    it("returns the newest report in scope, excluding the given one", async () => {
        const newest = report({progressPercent: 80, updateDate: new Date("2027-05-01")});
        mocks.reports = [report({progressPercent: 50}), newest, report({edifice, progressPercent: 90, updateDate: new Date("2027-06-01")})];
        expect((await findLatestConstructionProgress({company, project}, {excludeId: newest._id}))?.progressPercent).toBe(90);
        expect((await findLatestConstructionProgress({company, project, edifice}))?.progressPercent).toBe(90);
        mocks.reports.pop();
        expect((await findLatestConstructionProgress({company, project}, {excludeId: newest._id}))?.progressPercent).toBe(50);
    });
});
