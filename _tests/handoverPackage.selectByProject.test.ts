/** P13.12 debt: PD forms post the picked project to the handover package picker, which must list only its packages. */
import {describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const captured = vi.hoisted(() => ({config: undefined as undefined | {extraSelectFilter?: (params: Record<string, unknown>) => unknown}}));
vi.mock("@coreModule/api/crudRouterFactory", () => ({
    createCrudRouter: (config: typeof captured.config) => {
        captured.config = config;
        return {router: {}};
    },
}));

describe("handover package picker filter", () => {
    it("keeps the posted project's packages and offers all without one", async () => {
        await import("@propertyManagement/api/realEstate/private/handoverPackage");
        const filter = captured.config?.extraSelectFilter;
        expect(filter).toBeTypeOf("function");
        const project = new ObjectId();
        expect(await filter?.({project: project.toString()})).toEqual({project});
        expect(await filter?.({})).toEqual({});
    });
});
