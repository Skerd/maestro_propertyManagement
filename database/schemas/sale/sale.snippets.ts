import type {SaleBlank, SaleSimple} from "armonia/src/modules/propertyManagement/dto/sale.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import type {ISale} from "@propertyManagement/database/schemas/sale/sale";
import {defineSnippet} from "@coreModule/database/utilities/snippet";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {CompanyBlankSnippet} from "@coreModule/database/schemas/company/company.snippets";

export const SaleBlankSnippet = defineSnippet<ISale, SaleBlank>()({
    keys: {
        _id: {},
        name: {},
        saleCurrency: CurrencySimpleSnippet,
        buyer: SimpleBlankUserSnippet,
        buyerCompany: CompanyBlankSnippet,
    },
});

export const SaleSimpleSnippet = defineSnippet<ISale, SaleSimple>()({
    keys: {
        _id: {},
        name: {},
        finalPrice: {},
        saleDate: {},
        unit: UnitSimpleSnippet,
        buyer: SimpleBlankUserSnippet,
    },
});
