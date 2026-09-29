import type {ReservationBlank, ReservationDetail, ReservationSimple} from "armonia/src/modules/propertyManagement/dto/reservation.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import type {IReservation} from "@propertyManagement/database/schemas/reservation/reservation";
import {defineSnippet} from "@coreModule/database/utilities/snippet";
import {UnitSimpleSnippet} from "../unit/unit.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";

export const ReservationBlankSnippet = defineSnippet<IReservation, ReservationBlank>()({
    keys: {
        _id: {},
        name: {},
    },
});

export const ReservationSimpleSnippet = defineSnippet<IReservation, ReservationSimple>()({
    keys: {
        _id: {},
        name: {},
        unit: UnitSimpleSnippet,
    },
});

export const ReservationSnippet = defineSnippet<IReservation, ReservationDetail>()({
    keys: {
        _id: {},
        name: {},
        client: {
            keys: {
                name: {},
                surname: {},
                username: {},
            },
        },
        depositAmount: {},
        depositCurrency: CurrencySimpleSnippet,
        paid: {},
        isActive: {},
        reservationContract: MediaSimpleSnippet,
        additionalDocuments: MediaSimpleSnippet,
    },
});
