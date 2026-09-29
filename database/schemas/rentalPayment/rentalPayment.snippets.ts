import type {RentalPaymentSimple} from "armonia/src/modules/propertyManagement/dto/rentalPayment.dto";
import type {IRentalPayment} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const RentalPaymentSimpleSnippet = defineSnippet<IRentalPayment, RentalPaymentSimple>()({
    keys: {
        _id: {},
        name: {},
        status: {},
    },
});
