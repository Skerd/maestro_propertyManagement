import {FloorSimpleSnippet} from "../floor/floor.snippets";
import {UnitTypeSimpleSnippet} from "../unitType/unitType.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";

export const UnitSimpleSnippet = {
    keys: {
        name: {},
        unitNumber: {},
        unitType: UnitTypeSimpleSnippet,
    }
}

export const UnitSnippet = {
    keys: {
        name: {},
        unitNumber: {},
        unitType: UnitTypeSimpleSnippet,
        floor: FloorSimpleSnippet
    }
};

export const UnitSaleSnippet = {
    keys: {
        name: {},
        unitNumber: {},
        unitType: UnitTypeSimpleSnippet,
        floor: FloorSimpleSnippet,
        price: {},
        priceCurrency: CurrencySimpleSnippet
    }
}