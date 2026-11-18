import {describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {unitToSelect} from "../unitMapper.select";
import type {IUnit} from "../../../../database/schemas/unit/unit";

function unit(fields: {unitNumber?: string; name?: string; typeName?: string}): IUnit {
    const _id = new ObjectId();
    // A plain row as the select query returns it; only the fields the mapper reads matter.
    const row: Pick<IUnit, "_id" | "unitNumber" | "name" | "unitType"> = {
        _id,
        unitNumber: fields.unitNumber ?? "",
        name: fields.name ?? "",
        unitType: (fields.typeName ? {name: fields.typeName} : undefined) as IUnit["unitType"],
    };
    return row as IUnit;
}

describe("unitToSelect", () => {
    it("reads number, name and type", () => {
        expect(unitToSelect(unit({unitNumber: "3B", name: "Sea view", typeName: "Apartment"})).label).toBe("3B - Sea view - Apartment");
    });

    it("says the number once when the unit is named by it", () => {
        expect(unitToSelect(unit({unitNumber: "A0-02 Floor 0", name: "A0-02 Floor 0", typeName: "Apartment"})).label).toBe("A0-02 Floor 0 - Apartment");
    });

    it("falls back to the id when nothing names the unit", () => {
        const row = unit({});
        expect(unitToSelect(row).label).toBe(row._id.toString());
    });
});
