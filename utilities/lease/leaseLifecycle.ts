import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {LeaseStatus} from "../../database/schemas/lease/lease";
import {leaseService} from "../../database/schemas/lease/lease.service";
import {RentalPaymentStatus} from "../../database/schemas/rentalPayment/rentalPayment";
import {rentalPaymentService} from "../../database/schemas/rentalPayment/rentalPayment.service";
import {unitService} from "../../database/schemas/unit/unit.service";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

type Ctx = {
    session?: any;
    logger: any;
    languageCode: string;
    actionUserCtx?: {userId?: any};
    company: {_id: ObjectId};
};

export async function assertUnitRentable(unitId: ObjectId, ctx: Ctx): Promise<void> {
    const {logger, languageCode, session, company} = ctx;
    const unit = await unitService.findOneOrThrow(
        {_id: unitId, company: company._id},
        {session, logger, languageCode},
    );

    if (unit.status === UnitStatus.SOLD) {
        throw apiValidationException("unit_already_sold", "", null, languageCode);
    }
    if (unit.status === UnitStatus.RENTED) {
        throw apiValidationException("unit_already_rented", "", null, languageCode);
    }
    if (unit.status === UnitStatus.RESERVED) {
        throw apiValidationException("unit_already_has_active_reservation", "", null, languageCode);
    }
    if (unit.status !== UnitStatus.AVAILABLE) {
        throw apiValidationException("unit_not_available_for_lease", "", null, languageCode);
    }

    const activeLease = await leaseService.findOne(
        {unit: unitId, company: company._id, status: LeaseStatus.ACTIVE, deletedAt: null},
        {session, logger, languageCode},
    );
    if (activeLease) {
        throw apiValidationException("unit_has_active_lease", "", null, languageCode);
    }
}

export async function markUnitRented(unitId: ObjectId, ctx: Ctx): Promise<void> {
    const {logger, languageCode, session, actionUserCtx} = ctx;
    await unitService.updateByIdOrThrow(
        unitId,
        {$set: {status: UnitStatus.RENTED}},
        {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
    );
}

export async function releaseUnitIfRented(unitId: ObjectId, ctx: Ctx): Promise<void> {
    const {logger, languageCode, session, actionUserCtx, company} = ctx;
    const unit = await unitService.findOne(
        {_id: unitId, company: company._id},
        {session, logger, languageCode},
    );
    if (unit && unit.status === UnitStatus.RENTED) {
        await unitService.updateByIdOrThrow(
            unit._id,
            {$set: {status: UnitStatus.AVAILABLE}},
            {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
        );
    }
}

/** Waive unpaid rent rows (pending/overdue). Paid rows are left alone. */
export async function waiveOpenRentalPayments(leaseId: ObjectId, ctx: Ctx): Promise<void> {
    const {logger, languageCode, session, actionUserCtx, company} = ctx;
    await rentalPaymentService.updateMany(
        {
            lease: leaseId,
            company: company._id,
            status: {$in: [RentalPaymentStatus.PENDING, RentalPaymentStatus.OVERDUE]},
            deletedAt: null,
        },
        {$set: {status: RentalPaymentStatus.WAIVED}},
        {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
    );
}

export function unitIdFromLease(lease: {unit?: any}): ObjectId | null {
    const raw = lease.unit?._id ?? lease.unit;
    if (!raw) return null;
    return new ObjectId(raw.toString());
}
