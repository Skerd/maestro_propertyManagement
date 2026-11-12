/** P13.3 debt: floor, unit and PD forms post the picked project to the building picker, which must list only its buildings. */
import {describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {edificeSelectFilter} from "@propertyManagement/utilities/edifice/edificeSelectFilter";

describe("building picker filter", () => {
    it("keeps the posted project's buildings", () => {
        const project = new ObjectId();
        expect(edificeSelectFilter({project: project.toString()})).toEqual({project});
    });

    it("offers every building when no project, or a malformed one, is posted", () => {
        expect(edificeSelectFilter({})).toEqual({});
        expect(edificeSelectFilter({project: ""})).toEqual({});
        expect(edificeSelectFilter({project: "not-an-id"})).toEqual({});
    });
});
