import {ISale, ISaleHandoverChecklistItem} from "../../../database/schemas/sale/sale";
import {Sale} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.dto";
import type {SaleHandoverChecklistItem} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.dto";
import type {HandoverChecklistSourceScopeValue} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";
import type {ApprovalStage} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.dto";
import type {CompanyBlank} from "armonia/src/modules/core/dto/company.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {PaymentPlanSimple} from "armonia/src/modules/propertyManagement/dto/paymentPlan.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {ReservationBlank} from "armonia/src/modules/propertyManagement/dto/reservation.dto";
import type {UnitSale} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CompanyBlankSnippet} from "@coreModule/database/schemas/company/company.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {FloorSimpleSnippet} from "@propertyManagement/database/schemas/floor/floor.snippets";
import {PaymentPlanSimpleSnippet} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {ReservationBlankSnippet} from "@propertyManagement/database/schemas/reservation/reservation.snippets";
import {UnitSaleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    decimalToNumber,
    mapMedia,
    mapSnippet,
} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO, mapLifeCycleToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapSaleApprovalStage(stage: {
    decision: string;
    user?: object;
    notes?: string;
    reviewedAt?: Date | string;
}): ApprovalStage | undefined {
    if (!stage) return undefined;
    return {
        decision: stage.decision,
        user: mapSnippet<SimpleBlankUser>()(stage.user, SimpleBlankUserSnippet),
        notes: stage.notes,
        reviewedAt: stage.reviewedAt ? new Date(stage.reviewedAt).toISOString() : undefined,
    };
}

function mapHandoverChecklistItem(item: ISaleHandoverChecklistItem): SaleHandoverChecklistItem {
    const sourceScope = (item.sourceScope ?? "retained") as HandoverChecklistSourceScopeValue;
    return {
        _id: item._id != null ? String(item._id) : undefined,
        sourcePackageId: item.sourcePackageId != null ? String(item.sourcePackageId) : undefined,
        sourceItemId: item.sourceItemId != null ? String(item.sourceItemId) : undefined,
        sourceScope: item.retained ? "retained" : sourceScope,
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance as SaleHandoverChecklistItem["importance"],
        completed: !!item.completed,
        completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : undefined,
        completedBy: mapSnippet<SimpleBlankUser>()(item.completedBy, SimpleBlankUserSnippet),
        retained: !!item.retained,
    };
}

export function saleToDTO(sale: ISale): Sale {
    const unit = sale.unit as {floor?: {edifice?: {project?: object} & object} & object} | undefined;
    return {
        _id: sale._id.toString(),
        name: sale.name,
        unit: mapSnippet<UnitSale>()(sale.unit, UnitSaleSnippet)!,
        project: unit?.floor?.edifice?.project
            ? mapSnippet<ProjectSimple>()(unit.floor.edifice.project, ProjectSimpleSnippet)
            : undefined,
        edifice: unit?.floor?.edifice
            ? mapSnippet<EdificeSimple>()(unit.floor.edifice, EdificeSimpleSnippet)
            : undefined,
        floor: unit?.floor
            ? mapSnippet<FloorSimple>()(unit.floor, FloorSimpleSnippet)
            : undefined,
        paymentType: sale.paymentType,
        paymentPlan: mapSnippet<PaymentPlanSimple>()(sale.paymentPlan, PaymentPlanSimpleSnippet),
        reservation: mapSnippet<ReservationBlank>()(sale.reservation, ReservationBlankSnippet),
        listedUnitPrice: decimalToNumber(sale.listedUnitPrice),
        listedUnitCurrency: mapSnippet<CurrencySimple>()(sale.listedUnitCurrency, CurrencySimpleSnippet),
        saleExchangeRate: decimalToNumber(sale.saleExchangeRate),
        reservationDepositAmount: decimalToNumber(sale.reservationDepositAmount),
        reservationDepositCurrency: mapSnippet<CurrencySimple>()(sale.reservationDepositCurrency, CurrencySimpleSnippet),
        reservationExchangeRate: decimalToNumber(sale.reservationExchangeRate),
        reservationConvertedAmount: decimalToNumber(sale.reservationConvertedAmount),
        localDiscount: decimalToNumber(sale.localDiscount),
        buyer: mapSnippet<SimpleBlankUser>()(sale.buyer, SimpleBlankUserSnippet),
        buyerCompany: mapSnippet<CompanyBlank>()(sale.buyerCompany, CompanyBlankSnippet),
        purchaseContract: sale.purchaseContract ? mapMedia(sale.purchaseContract) : undefined,
        additionalDocuments: sale.additionalDocuments?.length
            ? sale.additionalDocuments.flatMap((doc) => {
                const mapped = mapMedia(doc);
                return mapped ? [mapped] : [];
            })
            : undefined,
        soldBy: mapSnippet<SimpleBlankUser>()(sale.soldBy, SimpleBlankUserSnippet)!,
        saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : undefined,
        finalPrice: decimalToNumber(sale.finalPrice),
        saleCurrency: mapSnippet<CurrencySimple>()(sale.saleCurrency, CurrencySimpleSnippet)!,
        notes: sale.notes,
        transactionReference: sale.transactionReference,
        saleConfirmationEmailSentAt: sale.saleConfirmationEmailSentAt
            ? new Date(sale.saleConfirmationEmailSentAt).toISOString()
            : undefined,
        approvalStatus: (sale as {approvalStatus?: string}).approvalStatus,
        saleApproval: mapSaleApprovalStage((sale as {saleApproval?: Parameters<typeof mapSaleApprovalStage>[0]}).saleApproval),
        handoverDate: sale.handoverDate ? new Date(sale.handoverDate).toISOString() : undefined,
        handoverCertificate: sale.handoverCertificate ? mapMedia(sale.handoverCertificate) : undefined,
        handedOverBy: mapSnippet<SimpleBlankUser>()(sale.handedOverBy, SimpleBlankUserSnippet),
        handoverNotes: sale.handoverNotes,
        handoverCompletedAt: sale.handoverCompletedAt ? new Date(sale.handoverCompletedAt).toISOString() : undefined,
        titleTransferDate: sale.titleTransferDate ? new Date(sale.titleTransferDate).toISOString() : undefined,
        deedNumber: sale.deedNumber,
        notaryName: sale.notaryName,
        titleTransferCertificate: sale.titleTransferCertificate ? mapMedia(sale.titleTransferCertificate) : undefined,
        handoverChecklistItems: Array.isArray(sale.handoverChecklistItems)
            ? sale.handoverChecklistItems.map(mapHandoverChecklistItem)
            : [],
        ...mapSoftDeleteToDTO(sale),
        ...mapOwnershipToDTO(sale),
        ...mapLifeCycleToDTO(sale),
    };
}

export function salesToDTO(sales: ISale[]): Sale[] {
    return sales.map(saleToDTO);
}
