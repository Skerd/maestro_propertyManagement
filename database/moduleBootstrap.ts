import type {Model} from "mongoose";
import Project from "@propertyManagement/database/schemas/project/project";
import Edifice from "@propertyManagement/database/schemas/edifice/edifice";
import Floor from "@propertyManagement/database/schemas/floor/floor";
import UnitType from "@propertyManagement/database/schemas/unitType/unitType";
import UnitTypeCategory from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory";
import Constructor from "@propertyManagement/database/schemas/constructor/constructor";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import Lead from "@propertyManagement/database/schemas/lead/lead";
import ConstructionUpdate from "@propertyManagement/database/schemas/constructionUpdate/constructionUpdate";
import Snag from "@propertyManagement/database/schemas/snag/snag";
import Milestone from "@propertyManagement/database/schemas/milestone/milestone";
import ScheduleTask from "@propertyManagement/database/schemas/scheduleTask/scheduleTask";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import ProjectDocument from "@propertyManagement/database/schemas/projectDocument/projectDocument";
import Permit from "@propertyManagement/database/schemas/permit/permit";
import Budget from "@propertyManagement/database/schemas/budget/budget";
import BoqItem from "@propertyManagement/database/schemas/boqItem/boqItem";
import CostCommitment from "@propertyManagement/database/schemas/costCommitment/costCommitment";
import WorkPackage from "@propertyManagement/database/schemas/workPackage/workPackage";
import ConstructionContract from "@propertyManagement/database/schemas/constructionContract/constructionContract";
import ProgressClaim from "@propertyManagement/database/schemas/progressClaim/progressClaim";
import Rfi from "@propertyManagement/database/schemas/rfi/rfi";
import Submittal from "@propertyManagement/database/schemas/submittal/submittal";
import VariationOrder from "@propertyManagement/database/schemas/variationOrder/variationOrder";
import LandParcel from "@propertyManagement/database/schemas/landParcel/landParcel";
import FeasibilityStudy from "@propertyManagement/database/schemas/feasibilityStudy/feasibilityStudy";
import SiteDiary from "@propertyManagement/database/schemas/siteDiary/siteDiary";
import SafetyIncident from "@propertyManagement/database/schemas/safetyIncident/safetyIncident";
import Warranty from "@propertyManagement/database/schemas/warranty/warranty";
import HandoverPackage from "@propertyManagement/database/schemas/handoverPackage/handoverPackage";
import CommissioningRecord from "@propertyManagement/database/schemas/commissioningRecord/commissioningRecord";
import DesignStage from "@propertyManagement/database/schemas/designStage/designStage";
import InspectionChecklistTemplate from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import ConsultantAppointment from "@propertyManagement/database/schemas/consultantAppointment/consultantAppointment";
import CostClassification from "@propertyManagement/database/schemas/costClassification/costClassification";
import Specification from "@propertyManagement/database/schemas/specification/specification";
import SpecificationItem from "@propertyManagement/database/schemas/specificationItem/specificationItem";
import Tender from "@propertyManagement/database/schemas/tender/tender";
import TenderInvitation from "@propertyManagement/database/schemas/tenderInvitation/tenderInvitation";
import Bid from "@propertyManagement/database/schemas/bid/bid";
import BidLine from "@propertyManagement/database/schemas/bidLine/bidLine";
import ApprovalWorkflow from "@propertyManagement/database/schemas/approvalWorkflow/approvalWorkflow";
import ApprovalRequest from "@propertyManagement/database/schemas/approvalRequest/approvalRequest";
import ContractorInvoice from "@propertyManagement/database/schemas/contractorInvoice/contractorInvoice";
import IncomingInvoice from "@propertyManagement/database/schemas/incomingInvoice/incomingInvoice";
import LiquidityPlan from "@propertyManagement/database/schemas/liquidityPlan/liquidityPlan";
import LiquidityLine from "@propertyManagement/database/schemas/liquidityLine/liquidityLine";
import FeeCalculation from "@propertyManagement/database/schemas/feeCalculation/feeCalculation";
import PlanMarkup from "@propertyManagement/database/schemas/planMarkup/planMarkup";
import Asset from "@propertyManagement/database/schemas/asset/asset";
import MaintenancePlan from "@propertyManagement/database/schemas/maintenancePlan/maintenancePlan";
import MaintenanceWorkOrder from "@propertyManagement/database/schemas/maintenanceWorkOrder/maintenanceWorkOrder";
import BimModel from "@propertyManagement/database/schemas/bimModel/bimModel";
import BimQuantity from "@propertyManagement/database/schemas/bimQuantity/bimQuantity";

export const propertyManagementModels: Model<any>[] = [
    Project,
    Edifice,
    Floor,
    Unit,
    UnitCost,
    UnitType,
    UnitTypeCategory,
    Constructor,
    Inspection,
    ModificationRequest,
    Reservation,
    Sale,
    PaymentPlan,
    Commission,
    Lead,
    ConstructionUpdate,
    Snag,
    Milestone,
    ScheduleTask,
    Lease,
    RentalPayment,
    ProjectDocument,
    Permit,
    Budget,
    BoqItem,
    CostCommitment,
    WorkPackage,
    ConstructionContract,
    ProgressClaim,
    Rfi,
    Submittal,
    VariationOrder,
    LandParcel,
    FeasibilityStudy,
    SiteDiary,
    SafetyIncident,
    Warranty,
    HandoverPackage,
    CommissioningRecord,
    DesignStage,
    InspectionChecklistTemplate,
    ConsultantAppointment,
    CostClassification,
    Specification,
    SpecificationItem,
    Tender,
    TenderInvitation,
    Bid,
    BidLine,
    ApprovalWorkflow,
    ApprovalRequest,
    ContractorInvoice,
    IncomingInvoice,
    LiquidityPlan,
    LiquidityLine,
    FeeCalculation,
    PlanMarkup,
    Asset,
    MaintenancePlan,
    MaintenanceWorkOrder,
    BimModel,
    BimQuantity,
];

export async function dropPropertyManagementCollections(): Promise<void> {
    for (const model of propertyManagementModels) {
        await model.collection.drop();
    }
}

export const moduleBootstrap = {
    models: propertyManagementModels,
    dropModuleCollections: dropPropertyManagementCollections,
};
