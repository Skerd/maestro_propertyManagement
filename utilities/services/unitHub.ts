/**
 * The unit's sheet as a hub (UX-03, D151): its sales, reservations, leases, rent rows, costs, inspections and
 * modification requests, newest first. Each list is read the way its own list route reads it: only when the caller's
 * role can read that model, with the caller's field grants (SEC-09).
 */

import type {ObjectId} from "mongodb";
import {readableListFetch} from "@coreModule/database/security/readableListFetch";
import type {UserContext} from "@coreModule/utilities/types/types";
import type {Unit} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import {inspectionService} from "@propertyManagement/database/schemas/inspection/inspection.service";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import {leaseService} from "@propertyManagement/database/schemas/lease/lease.service";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import {modificationRequestService} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.service";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import {rentalPaymentService} from "@propertyManagement/database/schemas/rentalPayment/rentalPayment.service";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import {unitCostService} from "@propertyManagement/database/schemas/unitCost/unitCost.service";
import {inspectionsToDTO} from "@propertyManagement/utilities/mappers/inspection/inspectionMapper.dto";
import {leasesToDTO} from "@propertyManagement/utilities/mappers/lease/leaseMapper.dto";
import {modificationRequestsToDTO} from "@propertyManagement/utilities/mappers/modificationRequest/modificationRequestMapper.dto";
import {rentalPaymentsToDTO} from "@propertyManagement/utilities/mappers/rentalPayment/rentalPaymentMapper.dto";
import {reservationsToDTO} from "@propertyManagement/utilities/mappers/reservation/reservationMapper.dto";
import {salesToDTO} from "@propertyManagement/utilities/mappers/sale/saleMapper.dto";
import {unitCostsToDTO} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.dto";

/** The newest records of each kind; the full history stays on each list page (the unit's records menu). */
const HUB_LIMIT = 20;

type HubCtx = {companyId: ObjectId; actionUserCtx: UserContext; languageCode: string};
export type UnitHub = Pick<Unit, "sales" | "reservations" | "leases" | "rentalPayments" | "costs" | "inspections" | "modificationRequests">;

export async function unitHub(unitId: ObjectId, ctx: HubCtx): Promise<UnitHub> {
    const filter = {company: ctx.companyId, deletedAt: null, unit: unitId};
    const salesFetch = readableListFetch(Sale, ctx);
    const reservationsFetch = readableListFetch(Reservation, ctx);
    const leasesFetch = readableListFetch(Lease, ctx);
    const rentalPaymentsFetch = readableListFetch(RentalPayment, ctx);
    const costsFetch = readableListFetch(UnitCost, ctx);
    const inspectionsFetch = readableListFetch(Inspection, ctx);
    const requestsFetch = readableListFetch(ModificationRequest, ctx);

    const [sales, reservations, leases, rentalPayments, costs, inspections, requests] = await Promise.all([
        salesFetch ? saleService.find(filter, {}, salesFetch.populate, salesFetch.select, {saleDate: -1}, HUB_LIMIT) : null,
        reservationsFetch ? reservationService.find(filter, {}, reservationsFetch.populate, reservationsFetch.select, {reservationDate: -1}, HUB_LIMIT) : null,
        leasesFetch ? leaseService.find(filter, {}, leasesFetch.populate, leasesFetch.select, {startDate: -1}, HUB_LIMIT) : null,
        rentalPaymentsFetch ? rentalPaymentService.find(filter, {}, rentalPaymentsFetch.populate, rentalPaymentsFetch.select, {dueDate: -1}, HUB_LIMIT) : null,
        costsFetch ? unitCostService.find(filter, {}, costsFetch.populate, costsFetch.select, {purchaseDate: -1}, HUB_LIMIT) : null,
        inspectionsFetch ? inspectionService.find(filter, {}, inspectionsFetch.populate, inspectionsFetch.select, {inspectionDate: -1}, HUB_LIMIT) : null,
        requestsFetch ? modificationRequestService.find(filter, {}, requestsFetch.populate, requestsFetch.select, {submittedAt: -1}, HUB_LIMIT) : null,
    ]);

    // The unit also keeps its own refs to costs, inspections and requests (codes only); on the sheet they give way
    // to the records themselves, or to nothing for a role that may not read that model.
    const hub: UnitHub = {
        costs: costs ? unitCostsToDTO(costs) : [],
        inspections: inspections ? inspectionsToDTO(inspections) : [],
        modificationRequests: requests ? modificationRequestsToDTO(requests) : [],
    };
    if (sales) hub.sales = salesToDTO(sales);
    if (reservations) hub.reservations = reservationsToDTO(reservations);
    if (leases) hub.leases = leasesToDTO(leases);
    if (rentalPayments) hub.rentalPayments = rentalPaymentsToDTO(rentalPayments);
    return hub;
}
