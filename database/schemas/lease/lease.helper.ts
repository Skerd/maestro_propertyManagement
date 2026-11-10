/**
 * Ending a lease. Staff terminating it (the `terminate` action) and the daily rental maintenance cron expiring it
 * end it through the one `endLease` (BE-02); each trigger adds only its own checks.
 */
import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import type {UserContext} from "@coreModule/utilities/types/types";
import {
    releaseUnitIfRented,
    unitIdFromLease,
    waiveOpenRentalPayments,
} from "@propertyManagement/utilities/lease/leaseLifecycle";
import {type ILease, LeaseStatus} from "./lease";
import {leaseService} from "./lease.service";

export type LeaseEnding =
    | {status: LeaseStatus.TERMINATED; terminationDate: string; terminationReason?: string}
    | {status: LeaseStatus.EXPIRED};

export type LeaseTransitionContext = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    companyId: ObjectId;
    /** Absent when a system job (the rental maintenance cron) ends the lease. */
    actionUserCtx?: UserContext;
};

/**
 * Ends an active lease: it is stamped terminated (with its day and reason) or expired, its unpaid rent is waived, and
 * its unit, while still rented, becomes available again.
 */
export async function endLease(lease: Pick<ILease, "_id" | "unit">, ending: LeaseEnding, ctx: LeaseTransitionContext): Promise<void> {
    const {session, logger, languageCode, companyId, actionUserCtx} = ctx;
    const $set = ending.status === LeaseStatus.TERMINATED
        ? {
            status: ending.status,
            terminationDate: ending.terminationDate,
            ...(ending.terminationReason ? {terminationReason: ending.terminationReason} : {}),
        }
        : {status: ending.status};

    await leaseService.updateByIdOrThrow(
        lease._id,
        {$set},
        {session, logger, languageCode, auditUserId: actionUserCtx?.userId},
    );

    const lifecycleCtx = {session, logger, languageCode, actionUserCtx, company: {_id: companyId}};
    await waiveOpenRentalPayments(lease._id, lifecycleCtx);
    const unitId = unitIdFromLease(lease);
    if (unitId) await releaseUnitIfRented(unitId, lifecycleCtx);
}
