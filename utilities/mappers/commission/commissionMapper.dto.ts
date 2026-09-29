import {ICommission} from "../../../database/schemas/commission/commission";
import {Commission} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/commission.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {ReservationBlank} from "armonia/src/modules/propertyManagement/dto/reservation.dto";
import type {SaleBlank} from "armonia/src/modules/propertyManagement/dto/sale.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ReservationBlankSnippet} from "@propertyManagement/database/schemas/reservation/reservation.snippets";
import {SaleBlankSnippet} from "@propertyManagement/database/schemas/sale/sale.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {decimalToNumber, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";

export function commissionToDTO(doc: ICommission): Commission {
    const sale = doc.sale as {unit?: object} | undefined;
    const reservation = doc.reservation as {unit?: object} | undefined;
    return {
        _id: doc._id.toString(),
        agent: mapSnippet<SimpleBlankUser>()(doc.agent, SimpleBlankUserSnippet),
        recordedByActionUser: mapSnippet<SimpleBlankUser>()(doc.recordedByActionUser, SimpleBlankUserSnippet),
        sourceType: doc.sourceType,
        sourceId: doc.sourceId?.toString?.() || String(doc.sourceId),
        basis: doc.basis,
        basisAmount: decimalToNumber(doc.basisAmount),
        ratePercent: typeof doc.ratePercent === "number" ? doc.ratePercent : 0,
        amount: decimalToNumber(doc.amount),
        sale: mapSnippet<SaleBlank>()(doc.sale, SaleBlankSnippet),
        reservation: mapSnippet<ReservationBlank>()(doc.reservation, ReservationBlankSnippet),
        currency: mapSnippet<CurrencySimple>()(doc.currency, CurrencySimpleSnippet),
        status: doc.status,
        notes: doc.notes,
        paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : undefined,
        voidedAt: doc.voidedAt ? new Date(doc.voidedAt).toISOString() : undefined,
        paymentReference: doc.paymentReference,
        paymentReceiptMediaId: doc.paymentReceiptMediaId ? mapMedia(doc.paymentReceiptMediaId) : undefined,
        splits: Array.isArray(doc.splits) && doc.splits.length > 0
            ? doc.splits.map((s) => ({
                agent: mapSnippet<SimpleBlankUser>()(s.agent, SimpleBlankUserSnippet),
                label: s.label,
                ratePercent: typeof s.ratePercent === "number" ? s.ratePercent : 0,
                amount: decimalToNumber(s.amount),
            }))
            : undefined,
        unit: mapSnippet<UnitSimple>()(reservation?.unit ?? sale?.unit, UnitSimpleSnippet),
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
    };
}

export function commissionsToDTO(rows: ICommission[]): Commission[] {
    return rows.map(commissionToDTO);
}
