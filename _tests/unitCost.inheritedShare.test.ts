/**
 * TD-B171: a floor/edifice/project unit cost is shared over all the units under it with `allocateMinor`, so a unit's
 * share is the same whether one unit or the whole floor is asked for, and the shares add up to the cost exactly.
 */
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {allPermissionTags} from "@coreModule/_tests/httpHarness";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
// Registered for the statistics' populates.
import "@propertyManagement/database/schemas/project/project";
import "@propertyManagement/database/schemas/edifice/edifice";
import "@propertyManagement/database/schemas/floor/floor";
import "@coreModule/database/schemas/currency/currency";
import "@coreModule/database/schemas/country/country";
import "@coreModule/database/schemas/state/state";
import "@coreModule/database/schemas/city/city";
import {inheritedUnitCostShareRows} from "@propertyManagement/database/schemas/unitCost/unitCostInheritedPipelines.util";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {actor, asTenant, dec, seedCompany, seedCurrency} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;

/** Floor 1 has three units, floor 2 one; ids ascend in creation order, so `floorOne[0]` gets the leftover cent. */
const floorOne: ObjectId[] = [];
const floorTwo: ObjectId[] = [];

beforeAll(async () => {
    await connectTestDatabase();
    await asCompany(async () => {
        await seedCompany(companyId, "Europe/Zurich");
        const chf = await seedCurrency(companyId, "CHF");
        const project = new ObjectId();
        const edifice = new ObjectId();
        const [floor1, floor2] = [new ObjectId(), new ObjectId()];
        await db().collection("projects").insertOne({_id: project, company: companyId, name: "Riverside", deletedAt: null});
        await db().collection("edifices").insertOne({_id: edifice, company: companyId, project, name: "Block A", deletedAt: null});
        await db().collection("floors").insertMany([
            {_id: floor1, company: companyId, edifice, project, name: "Floor 1", deletedAt: null},
            {_id: floor2, company: companyId, edifice, project, name: "Floor 2", deletedAt: null},
        ]);
        for (const [floor, list, count] of [[floor1, floorOne, 3], [floor2, floorTwo, 1]] as const) {
            for (let i = 0; i < count; i++) {
                const _id = new ObjectId();
                list.push(_id);
                await db().collection("units").insertOne({
                    _id, company: companyId, project, edifice, floor, unitType: new ObjectId(), unitNumber: `U-${list.length}`, name: `Unit ${list.length}`,
                    area: 80, price: dec("100000.00"), priceCurrency: chf, status: UnitStatus.AVAILABLE, deletedAt: null,
                });
            }
        }
        const cost = (name: string, scope: Record<string, ObjectId>, pricePerUnit: string) => ({
            _id: new ObjectId(), company: companyId, currency: chf, name, purchaseDate: "2026-04-01", verificationStatus: "verified", paymentStatus: "paid",
            expenditureItems: [{title: "Item", category: "material", amount: 1, unit: "pcs", pricePerUnit: dec(pricePerUnit)}],
            deletedAt: null, ...scope,
        });
        await db().collection("unitcosts").insertMany([
            cost("floor-cost", {project, edifice, floor: floor1}, "100.00"),
            cost("project-cost", {project}, "10.00"),
        ]);
    });
}, 120000);

afterAll(disconnectTestDatabase);

const paidOf = async (unitIds: ObjectId[]) => {
    const {logger} = actor(companyId);
    const {actionUserCtx} = actor(companyId, allPermissionTags([Unit, UnitCost]));
    const stats = await asCompany(() => unitService.calculateStatistics(unitIds, actionUserCtx, "en-US", {logger}));
    return Object.fromEntries(unitIds.map((id) => [id.toString(), stats[id.toString()]?.verifiedPaidUnitCosts?.[0]?.value]));
};

describe("inherited unit cost shares (TD-B171)", {timeout: 60000}, () => {
    it("gives a single unit the same share as the full set does", async () => {
        const all = [...floorOne, ...floorTwo];
        const full = await paidOf(all);
        // Floor cost 100.00 over 3 units (33.34 / 33.33 / 33.33) plus project cost 10.00 over 4 units (2.50 each).
        expect(full).toEqual({
            [floorOne[0].toString()]: 35.84,
            [floorOne[1].toString()]: 35.83,
            [floorOne[2].toString()]: 35.83,
            [floorTwo[0].toString()]: 2.5,
        });
        expect(Object.values(full).reduce((sum, value) => sum! + Math.round(value! * 100), 0)).toBe(11000);

        expect(await paidOf([floorOne[0]])).toEqual({[floorOne[0].toString()]: 35.84});
        expect(await paidOf([floorOne[2]])).toEqual({[floorOne[2].toString()]: 35.83});
        expect(await paidOf([floorTwo[0]])).toEqual({[floorTwo[0].toString()]: 2.5});
    });

    it("splits exactly and leaves out units that were not asked for", () => {
        const [a, b, c] = [new ObjectId(), new ObjectId(), new ObjectId()];
        const line = {currencyId: "chf", currencyName: "CHF", currencySymbol: "CHF", currencyAbbreviation: "CHF", currencyDecimalPlaces: 2};
        const rows = inheritedUnitCostShareRows([{...line, value: "0.05", targetUnitIds: [c, a, b]}], [b, c]);
        expect(rows).toEqual([
            {_id: b.toString(), collectedByCurrency: [{...line, value: "0.02"}]},
            {_id: c.toString(), collectedByCurrency: [{...line, value: "0.01"}]},
        ]);
    });
});
