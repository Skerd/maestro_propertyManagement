import {ClientSession} from "mongoose";
import {Decimal128, ObjectId} from "mongodb";
import Commission, {
    CommissionSourceType,
    CommissionStatus
} from "../../../database/schemas/commission/commission";
import {commissionService} from "../../../database/schemas/commission/commission.service";
import {IReservation} from "../../../database/schemas/reservation/reservation";
import {UserContext} from "@coreModule/utilities/types/types";
import {serverLogger} from "@coreModule/loggers/serverLog";
import {resolveCommissionRatePercent} from "./resolveCommissionRate";
import {ISale} from "../../../database/schemas/sale/sale";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {percentOfMinor, toMinor} from "armonia/src/modules/core/helpers/money";

type CommissionSourceParams = {
    sourceId: ObjectId,
    sourceType: CommissionSourceType
    companyId: ObjectId,
    session: ClientSession,
    logger: serverLogger,
}

/** `actionUserCtx` is absent when a system job (the reservation expiry cron) ends the source. */
type VoidPendingCommissionParams = CommissionSourceParams & {
    actionUserCtx?: UserContext,
}

type RecordCommissionParams = CommissionSourceParams & {
    actionUserCtx: UserContext,
    languageCode: string,
}

export async function recordCommission({sourceId, sourceType, companyId, session, actionUserCtx, logger, languageCode}: RecordCommissionParams): Promise<void> {

    let foundModel: ISale | IReservation; // = undefined;
    let baseAmount: Decimal128;
    let baseCurrency =  undefined;
    let baseAgent = undefined;
    if( sourceType === CommissionSourceType.RESERVATION ) {
        foundModel = await reservationService.findOneInSession({_id: sourceId, company: companyId}, session);
        if (!foundModel.depositAmount || !foundModel.depositCurrency || !foundModel.reservedBy) {
            return;
        }
        else{
            baseAmount = foundModel.depositAmount;
            baseCurrency = foundModel.depositCurrency;
            baseAgent = foundModel.reservedBy;
        }
    }
    else{
        foundModel = await saleService.findOneInSession({_id: sourceId, company: companyId}, session);
        if( !foundModel.finalPrice || !foundModel.saleCurrency || !foundModel.soldBy) {
            return;
        }
        else{
            baseAmount = foundModel.finalPrice;
            baseCurrency = foundModel.saleCurrency;
            baseAgent = foundModel.soldBy;
        }
    }
    if( !foundModel ){
        return;
    }

    const existing = await commissionService.findOne({
        company: companyId,
        sourceType: sourceType,
        sourceId: sourceId
    }, {session: session});

    if (existing) {
        if (existing.status === CommissionStatus.VOIDED) {
            existing.status = CommissionStatus.PENDING;
            existing.voidedAt = undefined;
            if (sourceType === CommissionSourceType.RESERVATION && !existing.reservation) {
                existing.reservation = foundModel as IReservation;
            }
            if (sourceType === CommissionSourceType.SALE && !existing.sale){
                existing.sale = foundModel as ISale;
            }
            existing.$locals = existing.$locals || {};
            existing.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
            await existing.save({session});
            logger.debug?.(`Commission un-voided for ${sourceType} - ${sourceId}`);
        }
        return;
    }

    const ratePercent = await resolveCommissionRatePercent({
        unitId: foundModel.unit._id,
        companyId,
        channel: sourceType === CommissionSourceType.RESERVATION ? "reservation" : "sale",
        session
    });

    // The commission is a percentage of the basis, rounded once to the basis currency's precision (D35).
    const currency = await currencyService.findOne({_id: nestedEntityToRef(baseCurrency), company: companyId}, {session}, undefined, "decimalPlaces");
    const decimals = currency?.decimalPlaces;

    const payload: any = {
        company: companyId,
        agent: baseAgent,
        recordedByActionUser: new ObjectId(actionUserCtx.userId),
        sourceType: sourceType,
        sourceId: sourceId,
        ...( sourceType === CommissionSourceType.RESERVATION ? {reservation: foundModel._id} : {sale: foundModel._id} ),
        basis: sourceType === CommissionSourceType.RESERVATION ? "depositAmount" : "finalPrice",
        basisAmount: baseAmount,
        ratePercent,
        amount: decimal128FromMinor(percentOfMinor(toMinor(baseAmount, decimals), ratePercent), decimals),
        currency: baseCurrency,
        status: CommissionStatus.PENDING
    };
    await commissionService.create(payload, {
        session,
        logger,
        languageCode,
        auditUserId: actionUserCtx.userId
    });
    logger.debug?.(`Commission recorded for ${sourceType} - ${sourceId}`);
}

export async function voidPendingCommission({sourceId, sourceType, companyId, session, actionUserCtx, logger}: VoidPendingCommissionParams): Promise<void> {
    if (!sourceId) {
        return;
    }
    const doc = await commissionService.findOne({
        company: companyId,
        sourceType: sourceType,
        sourceId: sourceId,
        status: {$in: [CommissionStatus.PENDING, CommissionStatus.PENDING_APPROVAL, CommissionStatus.APPROVED]},
    }, {session: session});
    if (!!doc) {
        doc.status = CommissionStatus.VOIDED;
        doc.voidedAt = new Date();
        doc.paidAt = undefined;
        if (actionUserCtx) {
            doc.$locals = doc.$locals || {};
            doc.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        }
        await doc.save({session});
        logger.debug?.(`Commission voided  ${sourceType} - ${sourceId}`);
    }
}




