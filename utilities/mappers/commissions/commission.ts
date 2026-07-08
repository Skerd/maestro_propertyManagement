import {ClientSession} from "mongoose";
import {Decimal128, ObjectId} from "mongodb";
import Commission, {
    CommissionSourceType,
    CommissionStatus
} from "../../../database/schemas/commission/commission";
import {commissionService} from "../../../database/schemas/commission/commission.service";
import Reservation, {IReservation} from "../../../database/schemas/reservation/reservation";
import {UserContext} from "@coreModule/utilities/types/types";
import {serverLogger} from "@coreModule/loggers/serverLog";
import {resolveCommissionRatePercent} from "./resolveCommissionRate";
import Sale, {ISale} from "../../../database/schemas/sale/sale";

type VoidPendingCommissionParams = {
    sourceId: ObjectId,
    sourceType: CommissionSourceType
    companyId: ObjectId,
    session: ClientSession,
    actionUserCtx: UserContext,
    logger: serverLogger,
}

type RecordCommissionParams = VoidPendingCommissionParams & {
    languageCode: string,
}

export async function recordCommission({sourceId, sourceType, companyId, session, actionUserCtx, logger, languageCode}: RecordCommissionParams): Promise<void> {

    let foundModel: ISale | IReservation; // = undefined;
    let baseAmount = 0;
    let baseCurrency =  undefined;
    let baseAgent = undefined;
    if( sourceType === CommissionSourceType.RESERVATION ) {
        foundModel = await Reservation.findOne({_id: sourceId, company: companyId}).session(session).exec();
        if (!foundModel.depositAmount || !foundModel.depositCurrency || !foundModel.reservedBy) {
            return;
        }
        else{
            baseAmount = parseFloat(foundModel.depositAmount.toString());
            baseCurrency = foundModel.depositCurrency;
            baseAgent = foundModel.reservedBy;
        }
    }
    else{
        foundModel = await Sale.findOne({_id: sourceId, company: companyId}).session(session).exec();
        if( !foundModel.finalPrice || !foundModel.saleCurrency || !foundModel.soldBy) {
            return;
        }
        else{
            baseAmount = parseFloat(foundModel.finalPrice.toString());
            baseCurrency = foundModel.saleCurrency;
            baseAgent = foundModel.soldBy;
        }
    }
    if( !foundModel ){
        return;
    }

    const existing = await Commission.findOne({
        company: companyId,
        sourceType: sourceType,
        sourceId: sourceId
    }).session(session);

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
        amount: Decimal128.fromString((baseAmount * (ratePercent / 100)).toFixed(2)),
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
    const doc = await Commission.findOne({company: companyId, sourceType: sourceType, sourceId: sourceId, status: CommissionStatus.PENDING}).session(session);
    if (!!doc) {
        doc.status = CommissionStatus.VOIDED;
        doc.voidedAt = new Date();
        doc.paidAt = undefined;
        doc.$locals = doc.$locals || {};
        doc.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await doc.save({session});
        logger.debug?.(`Commission voided  ${sourceType} - ${sourceId}`);
    }
}




