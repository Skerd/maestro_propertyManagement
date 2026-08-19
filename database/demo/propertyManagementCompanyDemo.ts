/**
 * Orchestrates the property-management demo data for a company.
 *
 * Called from `propertyManagement/database/companyDemoSeed.ts` after the reference
 * tables (unit type categories, unit types, constructors, cost classifications)
 * are in place. Everything here depends on those existing.
 *
 * Order matters: the hierarchy (project → edifice → floor → unit) is the trunk that
 * every downstream entity hangs off, so it seeds first. Units are always seeded as
 * `available_unit`; the commercial seeds (reservations, sales, leases) are what move
 * them to `reserved_unit` / `sold_unit` / `rented_unit`, and `applyUnitOperationalState`
 * runs last to derive that from whatever actually landed.
 */

import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {createHierarchyMedia} from "@propertyManagement/database/seeds/hierarchy/hierarchyMedia";
import {createStoryMedia} from "@propertyManagement/database/seeds/operations/storyMedia";
import {loadOperationsRefs} from "@propertyManagement/database/seeds/operations/operationsRefs";
import {applyUnitOperationalState} from "@propertyManagement/database/seeds/operations/unitOperationalState";
import {createProjects} from "@propertyManagement/database/schemas/project/project.defaults";
import {createEdifices} from "@propertyManagement/database/schemas/edifice/edifice.defaults";
import {createFloors} from "@propertyManagement/database/schemas/floor/floor.defaults";
import {createUnits} from "@propertyManagement/database/schemas/unit/unit.defaults";
import {createReservations} from "@propertyManagement/database/schemas/reservation/reservation.defaults";
import {createSales} from "@propertyManagement/database/schemas/sale/sale.defaults";
import {createPaymentPlans} from "@propertyManagement/database/schemas/paymentPlan/paymentPlan.defaults";
import {createLeases} from "@propertyManagement/database/schemas/lease/lease.defaults";
import {createRentalPayments} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment.defaults";
import {createCommissions} from "@propertyManagement/database/schemas/commission/commission.defaults";
import {createLeads} from "@propertyManagement/database/schemas/lead/lead.defaults";
import {createUnitCosts} from "@propertyManagement/database/schemas/unitCost/unitCost.defaults";
import {createInspections} from "@propertyManagement/database/schemas/inspection/inspection.defaults";
import {createModificationRequests} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.defaults";
import {createSnags} from "@propertyManagement/database/schemas/snag/snag.defaults";
import {createStoryTypes} from "@propertyManagement/database/schemas/storyType/storyType.defaults";
import {createStories} from "@propertyManagement/database/schemas/story/story.defaults";
import {createConstructionUpdates} from "@propertyManagement/database/schemas/constructionUpdate/constructionUpdate.defaults";
import {createPropertyManagementConfig} from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.defaults";
import {loadWorkflowCtx} from "@propertyManagement/database/seeds/workflow/workflowDemo";
import {ObjectId} from "mongodb";
import {createLandParcels} from "@propertyManagement/database/schemas/landParcel/landParcel.defaults";
import {createFeasibilityStudies} from "@propertyManagement/database/schemas/feasibilityStudy/feasibilityStudy.defaults";
import {createDesignStages} from "@propertyManagement/database/schemas/designStage/designStage.defaults";
import {createPermits} from "@propertyManagement/database/schemas/permit/permit.defaults";
import {createProjectDocuments} from "@propertyManagement/database/schemas/projectDocument/projectDocument.defaults";
import {createPlanMarkups} from "@propertyManagement/database/schemas/planMarkup/planMarkup.defaults";
import {createBimModels} from "@propertyManagement/database/schemas/bimModel/bimModel.defaults";
import {createBimQuantities} from "@propertyManagement/database/schemas/bimQuantity/bimQuantity.defaults";
import {createWorkPackages} from "@propertyManagement/database/schemas/workPackage/workPackage.defaults";
import {createBudgets} from "@propertyManagement/database/schemas/budget/budget.defaults";
import {createBoqItems} from "@propertyManagement/database/schemas/boqItem/boqItem.defaults";
import {createCostCommitments} from "@propertyManagement/database/schemas/costCommitment/costCommitment.defaults";
import {createSpecifications} from "@propertyManagement/database/schemas/specification/specification.defaults";
import {createSpecificationItems} from "@propertyManagement/database/schemas/specificationItem/specificationItem.defaults";
import {createConsultantAppointments} from "@propertyManagement/database/schemas/consultantAppointment/consultantAppointment.defaults";
import {createFeeCalculations} from "@propertyManagement/database/schemas/feeCalculation/feeCalculation.defaults";
import {createTenders} from "@propertyManagement/database/schemas/tender/tender.defaults";
import {createTenderInvitations} from "@propertyManagement/database/schemas/tenderInvitation/tenderInvitation.defaults";
import {createBids} from "@propertyManagement/database/schemas/bid/bid.defaults";
import {createBidLines} from "@propertyManagement/database/schemas/bidLine/bidLine.defaults";
import {createConstructionContracts} from "@propertyManagement/database/schemas/constructionContract/constructionContract.defaults";
import {createVariationOrders} from "@propertyManagement/database/schemas/variationOrder/variationOrder.defaults";
import {createProgressClaims} from "@propertyManagement/database/schemas/progressClaim/progressClaim.defaults";
import {createContractorInvoices} from "@propertyManagement/database/schemas/contractorInvoice/contractorInvoice.defaults";
import {createIncomingInvoices} from "@propertyManagement/database/schemas/incomingInvoice/incomingInvoice.defaults";
import {createMilestones} from "@propertyManagement/database/schemas/milestone/milestone.defaults";
import {createScheduleTasks} from "@propertyManagement/database/schemas/scheduleTask/scheduleTask.defaults";
import {createSiteDiaries} from "@propertyManagement/database/schemas/siteDiary/siteDiary.defaults";
import {createRfis} from "@propertyManagement/database/schemas/rfi/rfi.defaults";
import {createSubmittals} from "@propertyManagement/database/schemas/submittal/submittal.defaults";
import {createHandoverPackages} from "@propertyManagement/database/schemas/handoverPackage/handoverPackage.defaults";
import {createCommissioningRecords} from "@propertyManagement/database/schemas/commissioningRecord/commissioningRecord.defaults";
import {createWarranties} from "@propertyManagement/database/schemas/warranty/warranty.defaults";
import {createApprovalWorkflows} from "@propertyManagement/database/schemas/approvalWorkflow/approvalWorkflow.defaults";
import {createApprovalRequests} from "@propertyManagement/database/schemas/approvalRequest/approvalRequest.defaults";
import {createAssets} from "@propertyManagement/database/schemas/asset/asset.defaults";
import {createMaintenancePlans} from "@propertyManagement/database/schemas/maintenancePlan/maintenancePlan.defaults";
import {createMaintenanceWorkOrders} from "@propertyManagement/database/schemas/maintenanceWorkOrder/maintenanceWorkOrder.defaults";
import {createInspectionChecklistTemplates} from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate.defaults";
import {createSafetyIncidents} from "@propertyManagement/database/schemas/safetyIncident/safetyIncident.defaults";
import {createLiquidityPlans} from "@propertyManagement/database/schemas/liquidityPlan/liquidityPlan.defaults";
import {createLiquidityLines} from "@propertyManagement/database/schemas/liquidityLine/liquidityLine.defaults";

export async function seedPropertyManagementDemoData(
    parentLogger: serverLogger | undefined,
    company: ICompany,
): Promise<void> {
    const logger = getLogger("propertyManagement_demo_data", parentLogger);
    logger.start(`Seeding property management demo data for '${company.name}'...`);

    try {
        const availableMedia = await createHierarchyMedia(logger, company);

        const projectIds = await createProjects(logger, company, availableMedia);
        const edificeIds = await createEdifices(logger, company, availableMedia, projectIds);
        const floorIds = await createFloors(logger, company, availableMedia, edificeIds, projectIds);
        const unitIds = await createUnits(logger, company, availableMedia, floorIds, edificeIds, projectIds);

        logger.debug(
            `Hierarchy seeded: ${projectIds.size} projects, ${edificeIds.size} edifices, ` +
                `${floorIds.size} floors, ${unitIds.size} units.`,
        );

        const refs = await loadOperationsRefs();

        // Commercial chain: a sale may point back at the reservation it converted, and a
        // payment plan closes the link onto its sale, so these run in dependency order.
        const reservationIds = await createReservations(logger, company, refs, unitIds);
        const saleIds = await createSales(logger, company, refs, unitIds, reservationIds);
        await createPaymentPlans(logger, company, saleIds);
        const leaseIds = await createLeases(logger, company, refs, unitIds);
        await createRentalPayments(logger, company, refs, unitIds, leaseIds);
        await createCommissions(logger, company, refs, reservationIds, saleIds);

        // Construction and after-sales. Modification requests reference inspections.
        const inspectionIds = await createInspections(logger, company, refs, unitIds);
        await createModificationRequests(logger, company, refs, unitIds, inspectionIds);
        await createUnitCosts(logger, company, refs, projectIds, edificeIds, floorIds, unitIds);
        await createSnags(logger, company, refs, unitIds);
        await createLeads(logger, company, refs, projectIds, unitIds);

        // Public-site content.
        const storyMedia = await createStoryMedia(logger, company);
        const storyTypeIds = await createStoryTypes(logger, company);
        await createStories(logger, company, projectIds, storyTypeIds, storyMedia);
        await createConstructionUpdates(logger, company, projectIds, edificeIds);

        await createPropertyManagementConfig(logger, company);

        // Construction / commercial workflow hanging off Garda (and Aria for the sold-unit
        // handover). Must run before the unit-status pass so commercial docs are already
        // in place; these models do not themselves change unit status.
        const ctx = await loadWorkflowCtx(company, refs, projectIds, edificeIds, unitIds);
        const extra: Record<string, Map<string, ObjectId>> = {};
        extra.landParcels = await createLandParcels(logger, company, ctx, extra);
        extra.feasibilityStudies = await createFeasibilityStudies(logger, company, ctx, extra);
        extra.designStages = await createDesignStages(logger, company, ctx, extra);
        extra.permits = await createPermits(logger, company, ctx, extra);
        extra.projectDocuments = await createProjectDocuments(logger, company, ctx, extra);
        extra.planMarkups = await createPlanMarkups(logger, company, ctx, extra);
        extra.bimModels = await createBimModels(logger, company, ctx, extra);
        extra.bimQuantities = await createBimQuantities(logger, company, ctx, extra);
        extra.workPackages = await createWorkPackages(logger, company, ctx, extra);
        extra.budgets = await createBudgets(logger, company, ctx, extra);
        extra.boqItems = await createBoqItems(logger, company, ctx, extra);
        extra.costCommitments = await createCostCommitments(logger, company, ctx, extra);
        extra.specifications = await createSpecifications(logger, company, ctx, extra);
        extra.specificationItems = await createSpecificationItems(logger, company, ctx, extra);
        extra.consultantAppointments = await createConsultantAppointments(logger, company, ctx, extra);
        extra.feeCalculations = await createFeeCalculations(logger, company, ctx, extra);
        extra.tenders = await createTenders(logger, company, ctx, extra);
        extra.tenderInvitations = await createTenderInvitations(logger, company, ctx, extra);
        extra.bids = await createBids(logger, company, ctx, extra);
        extra.bidLines = await createBidLines(logger, company, ctx, extra);
        extra.constructionContracts = await createConstructionContracts(logger, company, ctx, extra);
        extra.variationOrders = await createVariationOrders(logger, company, ctx, extra);
        extra.progressClaims = await createProgressClaims(logger, company, ctx, extra);
        extra.contractorInvoices = await createContractorInvoices(logger, company, ctx, extra);
        extra.incomingInvoices = await createIncomingInvoices(logger, company, ctx, extra);
        extra.milestones = await createMilestones(logger, company, ctx, extra);
        extra.scheduleTasks = await createScheduleTasks(logger, company, ctx, extra);
        extra.siteDiaries = await createSiteDiaries(logger, company, ctx, extra);
        extra.rfis = await createRfis(logger, company, ctx, extra);
        extra.submittals = await createSubmittals(logger, company, ctx, extra);
        extra.handoverPackages = await createHandoverPackages(logger, company, ctx, extra);
        extra.commissioningRecords = await createCommissioningRecords(logger, company, ctx, extra);
        extra.warranties = await createWarranties(logger, company, ctx, extra);
        extra.approvalWorkflows = await createApprovalWorkflows(logger, company, ctx, extra);
        extra.approvalRequests = await createApprovalRequests(logger, company, ctx, extra);
        extra.assets = await createAssets(logger, company, ctx, extra);
        extra.maintenancePlans = await createMaintenancePlans(logger, company, ctx, extra);
        extra.maintenanceWorkOrders = await createMaintenanceWorkOrders(logger, company, ctx, extra);
        extra.inspectionChecklistTemplates = await createInspectionChecklistTemplates(logger, company, ctx, extra);
        extra.safetyIncidents = await createSafetyIncidents(logger, company, ctx, extra);
        extra.liquidityPlans = await createLiquidityPlans(logger, company, ctx, extra);
        extra.liquidityLines = await createLiquidityLines(logger, company, ctx, extra);

        await applyUnitOperationalState(logger, company, unitIds);

        logger.finish("Finished seeding property management demo data!");
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(e);
        logger.err(`Error seeding property management demo data: ${message}`);
        logger.fail("Failed to seed property management demo data!");
    }
}
