import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {recomputeFeeCalculationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/recomputeFeeCalculation.form.validator";
import {markEarnedFeeCalculationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/markEarnedFeeCalculation.form.validator";
import {markInvoicedFeeCalculationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/markInvoicedFeeCalculation.form.validator";
import {markPaidFeeCalculationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/markPaidFeeCalculation.form.validator";
import FeeCalculation from "./feeCalculation";
import ConsultantAppointment from "../consultantAppointment/consultantAppointment";
import {feeCalculationService} from "./feeCalculation.service";
import {feeCalculationToDTO} from "@propertyManagement/utilities/mappers/feeCalculation/feeCalculationMapper.dto";

function dec(v: any): number | undefined {
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v?.toString === "function") return Number(v.toString());
    return undefined;
}

async function reload(id: any, ctx: any) {
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("feecalculations").readFields!, FeeCalculation.schema);
        const updated = await feeCalculationService.findById(id, ctx, populate.populate);
        if (updated) return feeCalculationToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

async function move(params: Record<string, any>, label: string, from: string[], next: string): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id} = params;
    const existing = await feeCalculationService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
    if (!from.includes(existing.status ?? "planned")) {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    await feeCalculationService.updateByIdOrThrow(existing._id, {$set: {status: next}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    return reload(existing._id, {session, logger, languageCode});
}

export class FeeCalculationActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: recomputeFeeCalculationFormSchema})
    async recompute(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`FeeCalculation.recompute ` + String(_id) + `...`);
        const existing = await feeCalculationService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (["invoiced", "paid"].includes(existing.status ?? "planned")) {
            throw apiValidationException("invalid_status_for_recompute", "", null, languageCode);
        }
        const basis = dec(existing.basisAmount) ?? 0;
        const pct = existing.feePercent != null ? Number(existing.feePercent) : 0;
        const factor = existing.adjustmentFactor != null ? Number(existing.adjustmentFactor) : 1;
        let total = basis * (pct / 100) * (factor || 1);

        // Apply the consultant appointment cap if one is set.
        const appointment = await ConsultantAppointment.findOne({_id: existing.consultantAppointment, company: company._id, deletedAt: null}).select("cappedAmount").lean();
        const cap = appointment ? dec((appointment as any).cappedAmount) : undefined;
        if (cap != null && total > cap) total = cap;

        await feeCalculationService.updateByIdOrThrow(existing._id, {$set: {totalFee: total}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        logger.finish(`FeeCalculation.recompute done — ${total}`);
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markEarnedFeeCalculationFormSchema})
    async markEarned(params: Record<string, any>): Promise<any> {
        return move(params, "markEarned", ["planned"], "earned");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markInvoicedFeeCalculationFormSchema})
    async markInvoiced(params: Record<string, any>): Promise<any> {
        return move(params, "markInvoiced", ["earned"], "invoiced");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markPaidFeeCalculationFormSchema})
    async markPaid(params: Record<string, any>): Promise<any> {
        return move(params, "markPaid", ["invoiced"], "paid");
    }
}
