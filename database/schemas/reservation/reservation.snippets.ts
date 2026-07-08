import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {UnitSimpleSnippet} from "../unit/unit.snippets";

export const ReservationBlankSnippet = {
    keys: {
        name: {},
    }
}

export const ReservationSimpleSnippet = {
    keys: {
        name: {},
        unit: UnitSimpleSnippet
    }
}

export const ReservationSnippet = {
    keys: {
        name: {},
        client: {
            keys: {
                name: {},
                surname: {},
                username: {},
            }
        },
        depositAmount: {},
        depositCurrency: CurrencySimpleSnippet,
        paid: {},
        isActive: {},
        reservationContract: MediaSimpleSnippet,
        additionalDocuments: MediaSimpleSnippet,
    }
};
