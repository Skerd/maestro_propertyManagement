import {IModificationRequest} from "../../../database/schemas/modificationRequest/modificationRequest";
import {
    ApprovalStage,
    FinanceStageDetails,
    ModificationRequest
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.dto";
import {
    mapMedia,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {Inspection} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.dto";

function mapUnitRef(unit: any): ModificationRequest["unit"] | undefined {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() || unit.toString(),
        name: unit.name,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType ? {
            _id: unit.unitType._id?.toString() || unit.unitType.toString(),
            name: unit.unitType.name,
            icon: unit.unitType.icon
        } : undefined,
        floor: unit.floor ? {
            _id: unit.floor._id?.toString(),
            name: unit.floor.name,
            edifice: unit.floor.edifice ? {
                _id: unit.floor.edifice._id?.toString(),
                name: unit.floor.edifice.name,
                project: unit.floor.edifice.project ? {
                    _id: unit.floor.edifice.project._id?.toString(),
                    name: unit.floor.edifice.project.name
                } : undefined
            } : undefined
        } : undefined
    };
}

function mapApprovalStage(stage: any): ApprovalStage | undefined {
    if( !stage ){
        return undefined;
    }
    return {
        decision: stage.decision,
        user: mapPopulatedSimpleUser(stage.user),
        notes: stage.notes,
        reviewedAt: stage.reviewedAt ? new Date(stage.reviewedAt).toISOString() : undefined,
        media: Array.isArray(stage.media) && stage.media.length > 0 ? stage.media.map(mapMedia) : undefined,
        materialsPlan: Array.isArray(stage.materialsPlan) ? stage.materialsPlan.map((item: any) => ({
            item:         item.item,
            quantity:     item.quantity,
            unit:         item.unit,
            notes:        item.notes,
            pricePerUnit: item.pricePerUnit != null ? parseFloat(item.pricePerUnit.toString()) : undefined,
            currency:     item.currency ? {
                _id:    (item.currency as any)?._id?.toString() ?? item.currency.toString(),
                name:   (item.currency as any)?.name,
                symbol: (item.currency as any)?.symbol,
            } : undefined,
        })) : undefined,
        inspections: Array.isArray(stage.inspections) ? stage.inspections.map(mapPopulatedRef).filter(Boolean) : undefined
    };
}

function mapFinanceDetails(details: any): FinanceStageDetails | undefined {
    if (!details) return undefined;
    
    // Convert to plain object if it's a Mongoose document
    const plainDetails = details.toObject ? details.toObject() : details;
    
    const totalCost = plainDetails.totalCost;
    const totalCostNum = totalCost ? (typeof totalCost === 'object' && totalCost.toString ? parseFloat(totalCost.toString()) : totalCost) : 0;

    // Map costBreakdown - handle array, empty array, undefined, and null cases
    // Also handle Mongoose subdocument arrays
    let costBreakdown: any[] | undefined = undefined;
    const costBreakdownRaw = plainDetails.costBreakdown;
    
    if (costBreakdownRaw !== undefined && costBreakdownRaw !== null) {
        // Handle both regular arrays and Mongoose document arrays
        const costBreakdownArray = Array.isArray(costBreakdownRaw) ? costBreakdownRaw : (costBreakdownRaw.toArray ? costBreakdownRaw.toArray() : []);
            
        if (Array.isArray(costBreakdownArray) && costBreakdownArray.length > 0) {
            costBreakdown = costBreakdownArray.map((item: any) => {
                // Convert Mongoose subdocument to plain object if needed
                const plainItem = item && typeof item.toObject === 'function' ? item.toObject() : item;
                if (!plainItem) return null;
                
                const cost = plainItem.cost;
                const costNum = cost !== undefined && cost !== null ? (typeof cost === 'object' && cost.toString ? parseFloat(cost.toString()) : cost) : 0;
                    
                return {
                    item: plainItem.item,
                    cost: costNum,
                    quantity: plainItem.quantity != null ? plainItem.quantity : undefined,
                    unit: plainItem.unit,
                    source: plainItem.source
                };
            }).filter((item: any) => item !== null); // Filter out any null items
            
            // If all items were filtered out, set to undefined
            if (costBreakdown.length === 0) {
                costBreakdown = undefined;
            }
        }
    }

    return {
        totalCost: totalCostNum,
        currency: mapPopulatedSimpleCurrency(plainDetails.currency),
        costBreakdown: costBreakdown,
        media: !!plainDetails.media ? (Array.isArray(plainDetails.media) ? plainDetails.media : []).map(mapMedia) : undefined,
        notes: plainDetails.notes,
        estimatedCompletionDate: plainDetails.estimatedCompletionDate ? new Date(plainDetails.estimatedCompletionDate).toISOString() : undefined
    };
}

export function modificationRequestToDTO(request: IModificationRequest): ModificationRequest {

    return {
        _id: request._id.toString(),
        name: request.name,
        unit: mapUnitRef(request.unit),
        requestedBy: mapPopulatedSimpleUser(request.requestedBy),
        title: request.title,
        description: request.description,
        constructionType: request.constructionType,
        specifications: request.specifications,
        status: request.status,

        architectApproval: mapApprovalStage(request.architectApproval),
        engineerApproval: mapApprovalStage(request.engineerApproval),
        ceoApproval: mapApprovalStage(request.ceoApproval),
        financeDetails: mapFinanceDetails(request.financeDetails),
        clientCostApproval: mapApprovalStage((request as any).clientCostApproval),

        stageDueDate: (request as any).stageDueDate ? new Date((request as any).stageDueDate).toISOString() : undefined,
        clientNotifiedAt: request.clientNotifiedAt ? new Date(request.clientNotifiedAt).toISOString() : undefined,
        notificationSent: request.notificationSent,
        submittedAt: request.submittedAt ? new Date(request.submittedAt).toISOString() : undefined,

        deliveryApproval: mapApprovalStage(request.deliveryApproval),
        inspections: request.inspections ? request.inspections.map(mapPopulatedRef).filter(Boolean) : undefined,
        completedAt: request.completedAt ? new Date(request.completedAt).toISOString() : undefined,
        cancelledAt: request.cancelledAt ? new Date(request.cancelledAt).toISOString() : undefined,
        cancellationReason: request.cancellationReason,
        ...mapSoftDeleteToDTO(request),
        ...mapOwnershipToDTO(request)
    };
}

export function modificationRequestsToDTO(requests: IModificationRequest[]): ModificationRequest[] {
    return requests.map(modificationRequestToDTO);
}
