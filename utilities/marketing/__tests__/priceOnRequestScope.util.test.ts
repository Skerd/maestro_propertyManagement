import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const mocks = vi.hoisted(() => ({
    projectFind: vi.fn(),
    projectFindOne: vi.fn(),
    edificeFind: vi.fn(),
    edificeFindOne: vi.fn(),
    floorFind: vi.fn(),
    floorFindOne: vi.fn(),
}));

vi.mock("../../../database/schemas/project/project.service", () => ({
    projectService: {find: mocks.projectFind, findOne: mocks.projectFindOne},
}));
vi.mock("../../../database/schemas/edifice/edifice.service", () => ({
    edificeService: {find: mocks.edificeFind, findOne: mocks.edificeFindOne},
}));
vi.mock("../../../database/schemas/floor/floor.service", () => ({
    floorService: {find: mocks.floorFind, findOne: mocks.floorFindOne},
}));

import {loadEffectivePriceVisibility, loadPriceOnRequestScope} from "../priceOnRequestScope.util";

const EXPLICIT = {$in: ["hide", "show"]};

describe("loadPriceOnRequestScope", () => {
    const companyId = new ObjectId();

    beforeEach(() => {
        Object.values(mocks).forEach((mock) => mock.mockReset());
    });

    it("loads decided records top-down and resolves nearest-explicit decisions", async () => {
        const projectId = new ObjectId();
        const inheritingEdifice = new ObjectId();
        const shownEdifice = new ObjectId();
        const inheritingFloor = new ObjectId();
        const hiddenFloor = new ObjectId();
        mocks.projectFind.mockResolvedValue([{_id: projectId, priceVisibility: "hide"}]);
        mocks.edificeFind.mockResolvedValue([
            {_id: inheritingEdifice, project: projectId, priceVisibility: "inherit"},
            {_id: shownEdifice, project: projectId, priceVisibility: "show"},
        ]);
        mocks.floorFind.mockResolvedValue([
            {_id: inheritingFloor, edifice: shownEdifice, priceVisibility: "inherit"},
            {_id: hiddenFloor, edifice: shownEdifice, priceVisibility: "hide"},
        ]);

        const scope = await loadPriceOnRequestScope(companyId);

        expect(mocks.projectFind.mock.calls[0][0]).toEqual({company: companyId, deletedAt: null, priceVisibility: EXPLICIT});
        expect(mocks.edificeFind.mock.calls[0][0]).toEqual({
            company: companyId,
            deletedAt: null,
            $or: [{priceVisibility: EXPLICIT}, {project: {$in: [projectId]}}],
        });
        expect(mocks.floorFind.mock.calls[0][0]).toEqual({
            company: companyId,
            deletedAt: null,
            $or: [{priceVisibility: EXPLICIT}, {edifice: {$in: [inheritingEdifice, shownEdifice]}}],
        });

        expect(scope.edificeDecisions.get(inheritingEdifice.toString())).toBe("hide");
        expect(scope.edificeDecisions.get(shownEdifice.toString())).toBe("show");
        expect(scope.floorDecisions.get(inheritingFloor.toString())).toBe("show");
        expect(scope.floorDecisions.get(hiddenFloor.toString())).toBe("hide");
    });

    it("only looks for explicitly set records when no project decides", async () => {
        mocks.projectFind.mockResolvedValue([]);
        mocks.edificeFind.mockResolvedValue([]);
        mocks.floorFind.mockResolvedValue([]);

        const scope = await loadPriceOnRequestScope(companyId);

        expect(mocks.edificeFind.mock.calls[0][0].$or).toEqual([{priceVisibility: EXPLICIT}]);
        expect(mocks.floorFind.mock.calls[0][0].$or).toEqual([{priceVisibility: EXPLICIT}]);
        expect(scope.edificeDecisions.size).toBe(0);
        expect(scope.floorDecisions.size).toBe(0);
    });
});

describe("loadEffectivePriceVisibility", () => {
    const opts = {companyId: new ObjectId()};

    beforeEach(() => {
        Object.values(mocks).forEach((mock) => mock.mockReset());
    });

    it("reports a unit shown by its own override inside a hidden edifice", async () => {
        mocks.floorFindOne.mockResolvedValue({edifice: new ObjectId(), priceVisibility: "inherit"});
        mocks.edificeFindOne.mockResolvedValue({project: new ObjectId(), priceVisibility: "hide"});
        mocks.projectFindOne.mockResolvedValue({priceVisibility: "inherit"});

        await expect(loadEffectivePriceVisibility("unit", {floor: new ObjectId(), priceVisibility: "show"}, opts))
            .resolves.toEqual({hidden: false, source: "unit", key: "shown_unit"});
        await expect(loadEffectivePriceVisibility("unit", {floor: new ObjectId(), priceVisibility: "inherit"}, opts))
            .resolves.toEqual({hidden: true, source: "edifice", key: "hidden_edifice"});
    });

    it("resolves an edifice from its project and a project on its own", async () => {
        mocks.projectFindOne.mockResolvedValue({priceVisibility: "hide"});

        await expect(loadEffectivePriceVisibility("edifice", {project: new ObjectId()}, opts))
            .resolves.toEqual({hidden: true, source: "project", key: "hidden_project"});
        await expect(loadEffectivePriceVisibility("project", {priceVisibility: "inherit"}, opts))
            .resolves.toEqual({hidden: false, source: "default", key: "shown_default"});
    });
});
