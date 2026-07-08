import {ICommission} from "../../../database/schemas/commission/commission";
import {Commission} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/commission.dto";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {
    decimalToNumber,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";


function mapUnitRef(unit: any): Commission["unit"] | undefined {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() || unit.toString(),
        name: unit.name,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType ? {
            _id: unit.unitType._id?.toString() || unit.unitType.toString(),
            name: unit.unitType.name,
            icon: unit.unitType.icon
        } : undefined
    };
}

export function commissionToDTO(doc: ICommission | any): Commission {
    return {
        _id: doc._id.toString(),
        agent: mapPopulatedSimpleUser(doc.agent),
        recordedByActionUser: mapPopulatedSimpleUser(doc.recordedByActionUser),
        sourceType: doc.sourceType,
        sourceId: doc.sourceId?.toString?.() || String(doc.sourceId),
        basis: doc.basis,
        basisAmount: decimalToNumber(doc.basisAmount),
        ratePercent: typeof doc.ratePercent === "number" ? doc.ratePercent : 0,
        amount: decimalToNumber(doc.amount),
        sale: mapPopulatedRef(doc.sale),
        reservation: mapPopulatedRef(doc.reservation),
        currency: mapPopulatedSimpleCurrency(doc.currency),
        status: doc.status,
        notes: doc.notes,
        paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : undefined,
        voidedAt: doc.voidedAt ? new Date(doc.voidedAt).toISOString() : undefined,
        paymentReference: doc.paymentReference,
        paymentReceiptMediaId: doc.paymentReceiptMediaId
            ? {_id: doc.paymentReceiptMediaId._id?.toString?.() || doc.paymentReceiptMediaId.toString(), url: doc.paymentReceiptMediaId.url, name: doc.paymentReceiptMediaId.name}
            : undefined,
        splits: Array.isArray(doc.splits) && doc.splits.length > 0
            ? doc.splits.map((s: any) => ({
                agent: mapPopulatedSimpleUser(s.agent),
                label: s.label,
                ratePercent: typeof s.ratePercent === "number" ? s.ratePercent : 0,
                amount: decimalToNumber(s.amount),
            }))
            : undefined,
        unit: mapUnitRef( doc.reservation?.unit || doc.sale?.unit ),
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc)
    };
}

export function commissionsToDTO(rows: (ICommission | any)[]): Commission[] {
    return rows.map(commissionToDTO);
}
