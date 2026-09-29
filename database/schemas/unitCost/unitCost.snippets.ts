import type {UnitCostSimple} from "armonia/src/modules/propertyManagement/dto/unitCost.dto";
import type {IUnitCost} from "@propertyManagement/database/schemas/unitCost/unitCost";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const UnitCostSimpleSnippet = defineSnippet<IUnitCost, UnitCostSimple>()({
    keys: {
        _id: {},
        name: {},
        purchaseDate: {},
        verificationStatus: {},
        paymentStatus: {},
    },
});
