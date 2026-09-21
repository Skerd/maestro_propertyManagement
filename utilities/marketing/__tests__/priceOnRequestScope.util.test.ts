import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const mocks = vi.hoisted(() => ({
    projectFind: vi.fn(),
    edificeFind: vi.fn(),
    floorFind: vi.fn(),
}));

vi.mock("../../../database/schemas/project/project.service", () => ({projectService: {find: mocks.projectFind}}));
vi.mock("../../../database/schemas/edifice/edifice.service", () => ({edificeService: {find: mocks.edificeFind}}));
vi.mock("../../../database/schemas/floor/floor.service", () => ({floorService: {find: mocks.floorFind}}));

import {loadPriceOnRequestScope} from "../priceOnRequestScope.util";

describe("loadPriceOnRequestScope", () => {
    const companyId = new ObjectId();

    beforeEach(() => {
        mocks.projectFind.mockReset();
        mocks.edificeFind.mockReset();
        mocks.floorFind.mockReset();
    });

    it("cascades a project flag down to its edifices and their floors", async () => {
        const projectId = new ObjectId();
        const edificeId = new ObjectId();
        const floorId = new ObjectId();
        mocks.projectFind.mockResolvedValue([{_id: projectId}]);
        mocks.edificeFind.mockResolvedValue([{_id: edificeId}]);
        mocks.floorFind.mockResolvedValue([{_id: floorId}]);

        const scope = await loadPriceOnRequestScope(companyId);

        expect(mocks.projectFind.mock.calls[0][0]).toEqual({company: companyId, deletedAt: null, showPriceOnRequest: true});
        expect(mocks.edificeFind.mock.calls[0][0]).toEqual({
            company: companyId,
            deletedAt: null,
            $or: [{showPriceOnRequest: true}, {project: {$in: [projectId]}}],
        });
        expect(mocks.floorFind.mock.calls[0][0]).toEqual({
            company: companyId,
            deletedAt: null,
            $or: [{showPriceOnRequest: true}, {edifice: {$in: [edificeId]}}],
        });
        expect([...scope.edificeIds]).toEqual([edificeId.toString()]);
        expect([...scope.floorIds]).toEqual([floorId.toString()]);
    });

    it("only looks for directly flagged records when no parent is flagged", async () => {
        mocks.projectFind.mockResolvedValue([]);
        mocks.edificeFind.mockResolvedValue([]);
        mocks.floorFind.mockResolvedValue([]);

        const scope = await loadPriceOnRequestScope(companyId);

        expect(mocks.edificeFind.mock.calls[0][0].$or).toEqual([{showPriceOnRequest: true}]);
        expect(mocks.floorFind.mock.calls[0][0].$or).toEqual([{showPriceOnRequest: true}]);
        expect(scope.edificeIds.size).toBe(0);
        expect(scope.floorIds.size).toBe(0);
    });
});
