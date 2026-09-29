import {IModificationRequest} from "../../../database/schemas/modificationRequest/modificationRequest";
import {
    ApprovalStage,
    FinanceStageDetails,
    ModificationRequest
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {InspectionSimple} from "armonia/src/modules/propertyManagement/dto/inspection.dto";
import type {UnitWithFloor} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {InspectionSimpleSnippet} from "@propertyManagement/database/schemas/inspection/inspection.snippets";
import {UnitSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapApprovalStage(stage: {
    decision: string;
    user?: object;
    notes?: string;
    reviewedAt?: Date | string;
    media?: unknown[];
    materialsPlan?: {
        item: string;
        quantity?: number;
        unit?: string;
        notes?: string;
        pricePerUnit?: {toString(): string} | number;
        currency?: object;
    }[];
    inspections?: object[];
} | null | undefined): ApprovalStage | undefined {
    if (!stage) return undefined;
    return {
        decision: stage.decision,
        user: mapSnippet<SimpleBlankUser>()(stage.user, SimpleBlankUserSnippet),
        notes: stage.notes,
        reviewedAt: stage.reviewedAt ? new Date(stage.reviewedAt).toISOString() : undefined,
        media: Array.isArray(stage.media) && stage.media.length > 0 ? stage.media.map(mapMedia) : undefined,
        materialsPlan: Array.isArray(stage.materialsPlan)
            ? stage.materialsPlan.map((item) => ({
                item: item.item,
                quantity: item.quantity,
                unit: item.unit,
                notes: item.notes,
                pricePerUnit: item.pricePerUnit != null ? parseFloat(item.pricePerUnit.toString()) : undefined,
                currency: mapSnippet<CurrencySimple>()(item.currency, CurrencySimpleSnippet),
            }))
            : undefined,
        inspections: Array.isArray(stage.inspections)
            ? stage.inspections
                .map((inspection) => mapSnippet<InspectionSimple>()(inspection, InspectionSimpleSnippet))
                .filter((inspection): inspection is InspectionSimple => inspection != null)
            : undefined,
    };
}

function mapFinanceDetails(details: {
    toObject?: () => {
        totalCost?: unknown;
        currency?: object;
        costBreakdown?: unknown;
        media?: unknown;
        notes?: string;
        estimatedCompletionDate?: Date | string;
    };
    totalCost?: unknown;
    currency?: object;
    costBreakdown?: unknown;
    media?: unknown;
    notes?: string;
    estimatedCompletionDate?: Date | string;
} | null | undefined): FinanceStageDetails | undefined {
    if (!details) return undefined;

    const plainDetails = details.toObject ? details.toObject() : details;

    const totalCost = plainDetails.totalCost;
    const totalCostNum = totalCost
        ? (typeof totalCost === "object" && totalCost != null && "toString" in totalCost
            ? parseFloat(String(totalCost))
            : Number(totalCost))
        : 0;

    let costBreakdown: FinanceStageDetails["costBreakdown"];
    const costBreakdownRaw = plainDetails.costBreakdown;

    if (costBreakdownRaw != null) {
        const costBreakdownArray = Array.isArray(costBreakdownRaw)
            ? costBreakdownRaw
            : (costBreakdownRaw as {toArray?: () => unknown[]}).toArray?.() ?? [];

        if (costBreakdownArray.length > 0) {
            costBreakdown = costBreakdownArray.flatMap((item) => {
                const plainItem = item && typeof item === "object" && "toObject" in item
                    ? (item as {toObject: () => Record<string, unknown>}).toObject()
                    : item as Record<string, unknown> | null;
                if (!plainItem) return [];

                const cost = plainItem.cost;
                const costNum = cost != null
                    ? (typeof cost === "object" && "toString" in cost
                        ? parseFloat(String(cost))
                        : Number(cost))
                    : 0;

                return [{
                    item: plainItem.item as string | undefined,
                    cost: costNum,
                    quantity: plainItem.quantity != null ? Number(plainItem.quantity) : undefined,
                    unit: plainItem.unit as string | undefined,
                    source: plainItem.source as "engineer_material" | "manual" | undefined,
                }];
            });

            if (costBreakdown.length === 0) costBreakdown = undefined;
        }
    }

    return {
        totalCost: totalCostNum,
        currency: mapSnippet<CurrencySimple>()(plainDetails.currency as object | undefined, CurrencySimpleSnippet),
        costBreakdown,
        media: plainDetails.media
            ? (Array.isArray(plainDetails.media) ? plainDetails.media : []).map(mapMedia)
            : undefined,
        notes: plainDetails.notes,
        estimatedCompletionDate: plainDetails.estimatedCompletionDate
            ? new Date(plainDetails.estimatedCompletionDate).toISOString()
            : undefined,
    };
}

export function modificationRequestToDTO(request: IModificationRequest): ModificationRequest {
    return {
        _id: request._id.toString(),
        name: request.name,
        unit: mapSnippet<UnitWithFloor>()(request.unit, UnitSnippet)!,
        requestedBy: mapSnippet<SimpleBlankUser>()(request.requestedBy, SimpleBlankUserSnippet),
        title: request.title,
        description: request.description,
        constructionType: request.constructionType,
        specifications: request.specifications,
        status: request.status,
        architectApproval: mapApprovalStage(request.architectApproval),
        engineerApproval: mapApprovalStage(request.engineerApproval),
        ceoApproval: mapApprovalStage(request.ceoApproval),
        financeDetails: mapFinanceDetails(request.financeDetails),
        clientCostApproval: mapApprovalStage(request.clientCostApproval),
        stageDueDate: request.stageDueDate ? new Date(request.stageDueDate).toISOString() : undefined,
        clientNotifiedAt: request.clientNotifiedAt ? new Date(request.clientNotifiedAt).toISOString() : undefined,
        notificationSent: request.notificationSent,
        submittedAt: request.submittedAt ? new Date(request.submittedAt).toISOString() : undefined,
        deliveryApproval: mapApprovalStage(request.deliveryApproval),
        inspections: request.inspections
            ? request.inspections
                .map((inspection) => mapSnippet<InspectionSimple>()(inspection, InspectionSimpleSnippet))
                .filter((inspection): inspection is InspectionSimple => inspection != null)
            : undefined,
        completedAt: request.completedAt ? new Date(request.completedAt).toISOString() : undefined,
        cancelledAt: request.cancelledAt ? new Date(request.cancelledAt).toISOString() : undefined,
        cancellationReason: request.cancellationReason,
        ...mapSoftDeleteToDTO(request),
        ...mapOwnershipToDTO(request),
    };
}

export function modificationRequestsToDTO(requests: IModificationRequest[]): ModificationRequest[] {
    return requests.map(modificationRequestToDTO);
}
