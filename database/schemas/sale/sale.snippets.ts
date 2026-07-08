import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";

export const SaleBlankSnippet = {
    keys: {
        name: {},
        saleCurrency: CurrencySimpleSnippet,
    },
};

export const SaleSimpleSnippet = {
    keys: {
        name: {},
        finalPrice: {},
        saleDate: {},
        unit: UnitSimpleSnippet
    }
}