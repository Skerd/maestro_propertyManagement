import {ISale} from "../../../database/schemas/sale/sale";
import {Sale} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.dto";
import type {ApprovalStage} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.dto";
import {
    decimalToNumber,
    mapMedia,
    mapPopulatedRef,
    mapPopulatedSimpleCompany,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapSaleApprovalStage(stage: any): ApprovalStage | undefined {
    if (!stage) return undefined;
    return {
        decision: stage.decision,
        user: mapPopulatedSimpleUser(stage.user),
        notes: stage.notes,
        reviewedAt: stage.reviewedAt ? new Date(stage.reviewedAt).toISOString() : undefined,
    };
}

function mapUnitRef(unit: any): Sale["unit"] | undefined {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() || unit.toString(),
        name: unit.name,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType ?
            {
                _id: unit.unitType._id?.toString() || unit.unitType.toString(),
                name: unit.unitType.name,
                icon: unit.unitType.icon,
            }
            : undefined,
        price: decimalToNumber(unit.price),
        priceCurrency: mapPopulatedSimpleCurrency(unit.priceCurrency)
    };
}

export function saleToDTO(sale: ISale): Sale {

    console.log(mapPopulatedRef(sale.paymentPlan));

    return {
        _id: sale._id.toString(),
        name: sale.name,
        unit: mapUnitRef(sale.unit),
        project: mapPopulatedRef(sale?.unit?.floor?.edifice?.project),
        edifice: mapPopulatedRef(sale?.unit?.floor?.edifice),
        floor: mapPopulatedRef(sale?.unit?.floor),
        paymentType: sale.paymentType,
        paymentPlan: mapPopulatedRef(sale.paymentPlan),
        reservation: mapPopulatedRef(sale.reservation),
        listedUnitPrice: decimalToNumber(sale.listedUnitPrice),
        listedUnitCurrency: mapPopulatedSimpleCurrency(sale.listedUnitCurrency),
        saleExchangeRate: decimalToNumber(sale.saleExchangeRate),
        reservationDepositAmount: decimalToNumber(sale.reservationDepositAmount),
        reservationDepositCurrency: mapPopulatedSimpleCurrency(sale.reservationDepositCurrency),
        reservationExchangeRate: decimalToNumber(sale.reservationExchangeRate),
        reservationConvertedAmount: decimalToNumber(sale.reservationConvertedAmount),
        localDiscount: decimalToNumber(sale.localDiscount),
        buyer: mapPopulatedSimpleUser(sale.buyer),
        buyerCompany: mapPopulatedSimpleCompany(sale.buyerCompany),
        purchaseContract: sale.purchaseContract ? mapMedia(sale.purchaseContract) : undefined,
        additionalDocuments: sale.additionalDocuments?.length ? sale.additionalDocuments.map(mapMedia) : undefined,
        soldBy: mapPopulatedSimpleUser(sale.soldBy),
        saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : undefined,
        finalPrice: decimalToNumber(sale.finalPrice),
        saleCurrency: mapPopulatedSimpleCurrency(sale.saleCurrency),
        notes: sale.notes,
        transactionReference: sale.transactionReference,
        saleConfirmationEmailSentAt: sale.saleConfirmationEmailSentAt
            ? new Date(sale.saleConfirmationEmailSentAt).toISOString()
            : undefined,
        approvalStatus: (sale as any).approvalStatus,
        saleApproval: mapSaleApprovalStage((sale as any).saleApproval),
        handoverDate: sale.handoverDate ? new Date(sale.handoverDate).toISOString() : undefined,
        handoverCertificate: sale.handoverCertificate ? mapMedia(sale.handoverCertificate) : undefined,
        handedOverBy: mapPopulatedSimpleUser(sale.handedOverBy),
        handoverNotes: sale.handoverNotes,
        titleTransferDate: sale.titleTransferDate ? new Date(sale.titleTransferDate).toISOString() : undefined,
        deedNumber: sale.deedNumber,
        notaryName: sale.notaryName,
        titleTransferCertificate: sale.titleTransferCertificate ? mapMedia(sale.titleTransferCertificate) : undefined,
        ...mapSoftDeleteToDTO(sale),
        ...mapOwnershipToDTO(sale),
    };
}

export function salesToDTO(sales: ISale[]): Sale[] {
    return sales.map(saleToDTO);
}
