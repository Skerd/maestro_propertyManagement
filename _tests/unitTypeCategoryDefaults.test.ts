/**
 * The default unit type categories are words ("Residential"), not codes (TD-B247). A database seeded before that keeps
 * one row per category: the old "RESIDENTIAL" row is renamed in place, never joined by a second "Residential".
 */
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {getLogger} from "@coreModule/loggers/serverLog";
import Company, {type ICompany} from "@coreModule/database/schemas/company/company";
import UnitTypeCategory from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory";
import {createUnitTypeCategories, defaultUnitTypeCategoryNames} from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory.defaults";
import {asTenant, seedCompany} from "./sale.fixtures";

const companyId = new ObjectId();
let company: ICompany;
const db = () => mongoose.connection.db!;

beforeAll(async () => {
    await connectTestDatabase();
    await UnitTypeCategory.init();
    await seedCompany(companyId, "Europe/Tirane");
    const found = await Company.findById(companyId);
    if (!found) throw new Error("test company was not seeded");
    company = found;
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

describe("default unit type categories (TD-B247)", {timeout: 60000}, () => {
    it("renames an old capitalised category in place and adds the rest once", async () => {
        const old = new ObjectId();
        await db().collection("unittypecategories").insertOne({_id: old, name: "RESIDENTIAL", company: companyId, deletedAt: null});

        const ids = await asTenant(companyId)(() => createUnitTypeCategories(getLogger("test"), company));
        await asTenant(companyId)(() => createUnitTypeCategories(getLogger("test"), company));

        const rows = await db().collection("unittypecategories").find({company: companyId}).toArray();
        expect(rows.map((row) => row.name).sort()).toEqual([...defaultUnitTypeCategoryNames].sort());
        expect(rows.find((row) => row.name === "Residential")?._id.toString()).toBe(old.toString());
        expect(ids.get("Residential")?.toString()).toBe(old.toString());
    });
});
