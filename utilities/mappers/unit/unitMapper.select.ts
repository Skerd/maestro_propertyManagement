import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {IUnit} from "../../../database/schemas/unit/unit";

export function unitToSelect(unit: IUnit): ApiSelectDatum {
    let label = "";
    if (unit.unitNumber) {
        label = unit.unitNumber;
    }
    // Many units are named by their number; saying it twice ("A0-02 - A0-02") only makes the picker harder to scan.
    if (unit.name && unit.name !== unit.unitNumber) {
        label = label ? `${label} - ${unit.name}` : unit.name;
    }
    if (unit.unitType) {
        label = label ? `${label} - ${unit.unitType.name}` : unit.unitType.name;
    }
    if (!label) {
        label = unit._id.toString();
    }
    return {
        value: unit._id.toString(),
        label: label
    }
}

export function unitsToSelect(units: IUnit[]): ApiSelectDatum[] {
    return units.map(unitToSelect);
}