/**
 * Orchestrates the property-management demo data for a company.
 *
 * Called from `propertyManagement/database/companyDemoSeed.ts` after the reference
 * tables (unit type categories, unit types, constructors) are in place.
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
import {createStoryTypes} from "@propertyManagement/database/schemas/storyType/storyType.defaults";
import {createStories} from "@propertyManagement/database/schemas/story/story.defaults";
import {createPropertyManagementConfig} from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig.defaults";
import {loadWorkflowCtx} from "@propertyManagement/database/seeds/workflow/workflowDemo";
import {ObjectId} from "mongodb";
import {createHandoverPackages} from "@propertyManagement/database/schemas/handoverPackage/handoverPackage.defaults";
import {createInspectionChecklistTemplates} from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate.defaults";

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

        const reservationIds = await createReservations(logger, company, refs, unitIds);
        const saleIds = await createSales(logger, company, refs, unitIds, reservationIds);
        await createPaymentPlans(logger, company, saleIds);
        const leaseIds = await createLeases(logger, company, refs, unitIds);
        await createRentalPayments(logger, company, refs, unitIds, leaseIds);
        await createCommissions(logger, company, refs, reservationIds, saleIds);

        const inspectionIds = await createInspections(logger, company, refs, unitIds);
        await createModificationRequests(logger, company, refs, unitIds, inspectionIds);
        await createUnitCosts(logger, company, refs, projectIds, edificeIds, floorIds, unitIds);
        await createLeads(logger, company, refs, projectIds, unitIds);

        const storyMedia = await createStoryMedia(logger, company);
        const storyTypeIds = await createStoryTypes(logger, company);
        await createStories(logger, company, projectIds, storyTypeIds, storyMedia);

        await createPropertyManagementConfig(logger, company);

        const ctx = await loadWorkflowCtx(company, refs, projectIds, edificeIds, unitIds);
        const extra: Record<string, Map<string, ObjectId>> = {};
        extra.handoverPackages = await createHandoverPackages(logger, company, ctx, extra);
        extra.inspectionChecklistTemplates = await createInspectionChecklistTemplates(logger, company, ctx, extra);

        await applyUnitOperationalState(logger, company, unitIds);

        logger.finish("Finished seeding property management demo data!");
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(e);
        logger.err(`Error seeding property management demo data: ${message}`);
        logger.fail("Failed to seed property management demo data!");
    }
}
