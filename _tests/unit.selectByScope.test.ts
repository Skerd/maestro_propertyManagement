/** P13.12 debt: PD commissioning and warranty forms post the picked project and building to the unit picker. */
import {describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {unitSelectFilter} from "@propertyManagement/utilities/unit/unitSelectFilter";

describe("unit picker filter", () => {
    it("keeps the posted project's, building's and floor's units", () => {
        const project = new ObjectId();
        const edifice = new ObjectId();
        const floor = new ObjectId();
        expect(unitSelectFilter({project: project.toString()})).toEqual({project});
        expect(unitSelectFilter({project: project.toString(), edifice: edifice.toString(), floor: floor.toString()}))
            .toEqual({project, edifice, floor});
    });

    it("leaves a level open when its id is missing or malformed", () => {
        const edifice = new ObjectId();
        expect(unitSelectFilter({})).toEqual({});
        expect(unitSelectFilter({project: "", edifice: edifice.toString()})).toEqual({edifice});
        expect(unitSelectFilter({project: "not-an-id", floor: null})).toEqual({});
    });
});
