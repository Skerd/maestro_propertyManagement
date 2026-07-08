import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {terminateLeaseFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/terminateLease.form.validator";
import {returnDepositFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/returnDeposit.form.validator";
import type {Lease as LeaseData} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.dto";
import {leaseToDTO} from "@propertyManagement/utilities/mappers/lease/leaseMapper.dto";
import {
    releaseUnitIfRented,
    unitIdFromLease,
    waiveOpenRentalPayments,
} from "@propertyManagement/utilities/lease/leaseLifecycle";
import Lease, {LeaseStatus} from "./lease";
import {leaseService} from "./lease.service";

async function loadLeaseForAction(params: Record<string, any>) {
    const {logger, languageCode, session, company, _id} = params;
    return leaseService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );
}

async function returnLeaseDto(leaseId: any, params: Record<string, any>): Promise<LeaseData | undefined> {
    const {logger, languageCode, session} = params;
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("leases").readFields!, Lease.schema);
        const updated = await leaseService.findById(leaseId, {session, logger, languageCode}, populate.populate);
        if (updated) return leaseToDTO(updated);
    } catch {
        logger.debug("User has no read permission on lease after action");
    }
    return undefined;
}

export class LeaseActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      terminateLeaseFormSchema,
    })
    async terminate(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, terminationReason, terminationDate} = params;

        logger.start(`Terminating lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (existing.status !== LeaseStatus.ACTIVE) {
            throw apiValidationException("lease_not_active", "", null, languageCode);
        }

        const endedAt = terminationDate ? new Date(terminationDate) : new Date();
        await leaseService.updateByIdOrThrow(
            existing._id,
            {
                $set: {
                    status: LeaseStatus.TERMINATED,
                    terminationDate: endedAt,
                    ...(terminationReason != null && terminationReason !== ""
                        ? {terminationReason: String(terminationReason).trim()}
                        : {}),
                },
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const ctx = {session, logger, languageCode, actionUserCtx, company};
        await waiveOpenRentalPayments(existing._id, ctx);
        const unitId = unitIdFromLease(existing);
        if (unitId) await releaseUnitIfRented(unitId, ctx);

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Terminated lease ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      returnDepositFormSchema,
    })
    async returnDeposit(params: Record<string, any>): Promise<LeaseData | undefined> {
        const {logger, languageCode, session, actionUserCtx, _id, depositReturnedAt} = params;

        logger.start(`Returning deposit for lease ${_id}...`);

        const existing = await loadLeaseForAction(params);
        if (!existing.depositPaid) {
            throw apiValidationException("lease_deposit_not_paid", "", null, languageCode);
        }
        if (existing.depositReturnedAt) {
            throw apiValidationException("lease_deposit_already_returned", "", null, languageCode);
        }

        const returnedAt = depositReturnedAt ? new Date(depositReturnedAt) : new Date();
        await leaseService.updateByIdOrThrow(
            existing._id,
            {$set: {depositReturnedAt: returnedAt}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const returnData = await returnLeaseDto(existing._id, params);
        logger.finish(`Returned deposit for lease ${_id}`);
        return returnData;
    }
}
