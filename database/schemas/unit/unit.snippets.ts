import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {UnitSale, UnitSimple, UnitWithFloor} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import type {UnitTypeSimple} from "armonia/src/modules/propertyManagement/dto/unitType.dto";
import type {IUnit} from "@propertyManagement/database/schemas/unit/unit";
import {defineSnippet} from "@coreModule/database/utilities/snippet";
import {FloorSimpleSnippet} from "../floor/floor.snippets";
import {UnitTypeSimpleSnippet} from "../unitType/unitType.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";

export const UnitSimpleSnippet = defineSnippet<IUnit, UnitSimple>()({
    keys: {
        _id: {},
        name: {},
        unitNumber: {},
        unitType: UnitTypeSimpleSnippet,
    },
});

export const UnitSnippet = defineSnippet<IUnit, UnitWithFloor>()({
    keys: {
        _id: {},
        name: {},
        unitNumber: {},
        unitType: UnitTypeSimpleSnippet,
        floor: FloorSimpleSnippet,
    },
});

export const UnitSaleSnippet = defineSnippet<IUnit, UnitSale>()({
    keys: {
        _id: {},
        name: {},
        unitNumber: {},
        unitType: UnitTypeSimpleSnippet,
        floor: FloorSimpleSnippet,
        price: {},
        priceCurrency: CurrencySimpleSnippet,
    },
});
