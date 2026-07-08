import {ObjectId, Decimal128} from "mongodb";
import Decimal from "decimal.js";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {approveSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/approveSale.form.validator";
import {manualSaleClientEmailFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/manualSaleClientEmail.form.validator";
import {payInstallmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/payInstallment.form.validator";
import {restructurePaymentPlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/restructurePaymentPlan.form.validator";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import Sale, {SaleApprovalStatus, SalePaymentType} from "./sale";
import PaymentPlan, {
    computePaymentPlanRemainingBalance,
    InstallmentStatus,
    PaymentPlanStatus,
} from "../paymentPlan/paymentPlan";
import {saleService} from "./sale.service";
import {unitService} from "../unit/unit.service";
import {paymentPlanService} from "../paymentPlan/paymentPlan.service";
import {saleToDTO} from "@propertyManagement/utilities/mappers/sale/saleMapper.dto";
import {paymentPlanToDTO} from "@propertyManagement/utilities/mappers/paymentPlan/paymentPlanMapper.dto";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {
    dispatchSaleClientEmail,
    formatInstallmentDueDateForEmail,
    type DispatchSaleClientEmailInput,
} from "@propertyManagement/utilities/database/sale/saleClientEmailDispatch";
import type {Sale as SaleData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.dto";
import type {PaymentPlan as PaymentPlanData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/paymentPlan.dto";
import {
    allocatePaymentPlanContractInterest,
    parseIsoDatePrefix,
    parseMoneyInput,
    type PaymentPlanInstallmentScheduleInput,
} from "@propertyManagement/utilities/sale/paymentPlanContractInterest";
import {
    isPastExpirationUtcEndOfDay,
    utcCalendarDaysUntilExpirationDay,
} from "@propertyManagement/utilities/reservation/reservationExpirationCalendar";
import {formatMoneyAmountForEmail} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import type {ManualSaleClientEmailForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/manualSaleClientEmail.form.type";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

function finalPriceDisplayForEmail(
    finalPrice: number | Decimal128 | undefined,
    currencySymbol: string | undefined,
    languageCode: string,
): string | undefined {
    if (finalPrice == null) return undefined;
    const raw =
        typeof finalPrice === "object" && finalPrice !== null && "toString" in finalPrice
            ? finalPrice.toString()
            : String(finalPrice);
    const amt = formatMoneyAmountForEmail(raw, languageCode);
    return currencySymbol ? `${amt} ${currencySymbol}` : amt;
}

async function unitPriceDisplayForEmail(foundUnit: any, companyId: ObjectId, languageCode: string): Promise<string | undefined> {
    try {
        const pc = foundUnit.priceCurrency;
        const pcid = pc instanceof ObjectId ? pc : pc?._id;
        const pcDoc = pcid ? await currencyService.findOne({_id: new ObjectId(pcid), company: companyId}) : undefined;
        const sym = pcDoc?.symbol ?? "";
        const amt = formatMoneyAmountForEmail(foundUnit.price.toString(), languageCode);
        return sym ? `${amt} ${sym}` : amt;
    } catch {
        return undefined;
    }
}

export class SaleActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        transaction: true,
        schema: approveSaleFormSchema,
    })
    async approveSale(params: Record<string, any>): Promise<SaleData | undefined> {
        const {logger, languageCode, session, _id, decision, notes, actionUserCtx, company} = params;

        logger.start(`Sale approval decision "${decision}" for sale: ${_id}...`);
        // SchemaGuard.checkModelPermission(Sale, "update", actionUserCtx, languageCode); //TODO check this too !important

        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if ((sale as any).approvalStatus !== SaleApprovalStatus.PENDING_APPROVAL) {
            throw apiValidationException("sale_not_pending_approval", "", null, languageCode);
        }

        const newStatus = decision === "approved" ? SaleApprovalStatus.APPROVED : SaleApprovalStatus.REJECTED;

        await saleService.updateByIdOrThrow(
            sale._id,
            {
                $set: {
                    approvalStatus: newStatus,
                    saleApproval: {
                        decision,
                        user: new ObjectId(actionUserCtx.userId),
                        notes: notes ?? undefined,
                        reviewedAt: new Date(),
                    },
                },
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        if (decision === "rejected") {
            const unit = await unitService.findOneOrThrow(
                {_id: sale.unit, company: company._id},
                {session, logger, languageCode},
            );
            unit.status = UnitStatus.AVAILABLE;
            unit.sale = undefined;
            unit.$locals = unit.$locals || {};
            unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
            await unit.save({session});
        }

        const soldById = (sale.soldBy as any)?._id?.toString() ?? sale.soldBy?.toString();
        const buyerId = (sale.buyer as any)?._id?.toString() ?? (sale.buyer as any)?.toString();

        const notifCode =
            decision === "approved" ? NotificationEventCodes.SALE_APPROVED : NotificationEventCodes.SALE_REJECTED;
        const notifReceivers = [soldById, buyerId].filter((id): id is string => !!id);
        if (notifReceivers.length) {
            emitNotificationEvent(notifCode, {
                receiverIds: notifReceivers,
                payload: {
                    companyId: company._id.toString(),
                    saleId: sale._id.toString(),
                    decision,
                    notes,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        let returnSale: SaleData | undefined;
        try {
            const readFields = SchemaGuard.sanitizeFields(
                Sale,
                getModelCollectedData("sales").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readFields, Sale.schema);
            const updated = await saleService.findById(sale._id, {session, logger, languageCode}, populate.populate);
            returnSale = saleToDTO(updated);
        } catch {
            logger.debug("User has no read permission on sale after approval!");
        }

        logger.finish(`Sale ${decision}: ${_id}`);
        return returnSale;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        schema: manualSaleClientEmailFormSchema,
    })
    async manualClientEmail(params: Record<string, any>): Promise<{ok: true}> {
        const {logger, languageCode, _id, action, installmentNumber, actionUserCtx, company} =
            params as Record<string, any> & ManualSaleClientEmailForm;

        logger.start(`Manual sale client email: ${action} for ${_id}`);

        try {
            SchemaGuard.sanitizeFields(Sale, {buyer: {}}, "read", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("sale_not_found", "", null, languageCode);
        }

        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            [
                {path: "buyer", select: "username name surname fullName"},
                {path: "unit", select: "unitNumber name price", populate: [{path: "priceCurrency", select: "symbol"}]},
                {path: "saleCurrency", select: "symbol"},
                {path: "company", select: "name"},
                {path: "paymentPlan", select: "installments status"},
                {path: "purchaseContract", select: "_id"},
            ],
        );

        if (sale.deletedAt) {
            throw apiValidationException("sale_not_found", "", null, languageCode);
        }

        const rawBuyer = sale.buyer as {_id?: ObjectId} | ObjectId | null | undefined;
        const buyerUserId =
            rawBuyer instanceof ObjectId
                ? rawBuyer
                : rawBuyer && typeof rawBuyer === "object" && rawBuyer._id
                  ? rawBuyer._id
                  : undefined;
        if (!buyerUserId) {
            throw apiValidationException("sale_buyer_missing", "", null, languageCode);
        }

        const companyRef = sale.company as {name?: string} | undefined;
        const companyName = companyRef?.name ?? company.name ?? "";

        const unitRef = sale.unit as
            | {unitNumber?: string | number; name?: string; price?: Decimal128; priceCurrency?: {symbol?: string}}
            | undefined;
        const unitNumber = unitRef?.unitNumber != null ? String(unitRef.unitNumber) : undefined;
        const unitDisplayName = unitRef?.name;
        const saleSym = (sale.saleCurrency as {symbol?: string} | undefined)?.symbol;

        let unitPriceDisplay: string | undefined;
        if (unitRef?.price != null) {
            const sym = unitRef.priceCurrency?.symbol ?? "";
            const amt = formatMoneyAmountForEmail(unitRef.price.toString(), languageCode ?? "en-US");
            unitPriceDisplay = sym ? `${amt} ${sym}` : amt;
        }

        const finalPriceDisplay = finalPriceDisplayForEmail(sale.finalPrice, saleSym, languageCode ?? "en-US");

        const purchaseContractRaw = sale.purchaseContract as ObjectId | {_id?: ObjectId} | undefined | null;
        const purchaseContractMediaId =
            purchaseContractRaw instanceof ObjectId
                ? purchaseContractRaw.toString()
                : purchaseContractRaw && typeof purchaseContractRaw === "object" && purchaseContractRaw._id
                  ? purchaseContractRaw._id.toString()
                  : undefined;

        const paymentType: "cash" | "payment_plan" =
            sale.paymentType === SalePaymentType.PAYMENT_PLAN ? "payment_plan" : "cash";

        const base = {
            clientUserId: buyerUserId,
            languageCode: languageCode ?? "en-US",
            companyId: company._id.toString(),
            companyName,
            saleId: sale._id.toString(),
            saleCode: sale.name,
            paymentType,
            unitNumber,
            unitDisplayName,
            unitPriceDisplay,
            finalPriceDisplay,
        } as const;

        const lang = languageCode ?? "en-US";
        let payload: DispatchSaleClientEmailInput;

        if (action === "send_sale_confirmation") {
            let downPaymentDisplay: string | undefined;
            let numberOfInstallments: number | undefined;
            if (paymentType === "payment_plan" && sale.paymentPlan) {
                const pp = await paymentPlanService.findOneOrThrow(
                    {_id: sale.paymentPlan, company: company._id},
                    {logger, languageCode},
                    "downPayment numberOfInstallments",
                );
                if (pp.downPayment != null) {
                    const dAmt = formatMoneyAmountForEmail(pp.downPayment.toString(), lang);
                    downPaymentDisplay = saleSym ? `${dAmt} ${saleSym}` : dAmt;
                }
                numberOfInstallments = pp.numberOfInstallments;
            }
            payload = {
                ...base,
                kind: "sale_created",
                downPaymentDisplay,
                numberOfInstallments,
                purchaseContractMediaId,
            };
        } else {
            if (installmentNumber == null || !Number.isFinite(Number(installmentNumber))) {
                throw apiValidationException("manual_sale_email_installment_required", "", null, languageCode);
            }
            const instNum = Math.floor(Number(installmentNumber));
            if (paymentType !== "payment_plan" || !sale.paymentPlan) {
                throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
            }
            const plan = await paymentPlanService.findOneOrThrow(
                {_id: sale.paymentPlan, company: company._id},
                {logger, languageCode},
                "installments",
            );
            const inst = plan.installments?.find((i: {installmentNumber: number}) => i.installmentNumber === instNum);
            if (!inst) {
                throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
            }
            const due = new Date(inst.dueDate);
            const dueIso = due.toISOString();
            const dueFormatted = formatInstallmentDueDateForEmail(dueIso, lang);
            const instAmt = formatMoneyAmountForEmail(inst.amount.toString(), lang);
            const installmentAmountDisplay = saleSym ? `${instAmt} ${saleSym}` : instAmt;
            const past = isPastExpirationUtcEndOfDay(due);
            const diff = utcCalendarDaysUntilExpirationDay(due);

            const instCommon = {
                ...base,
                installmentNumber: instNum,
                installmentAmountDisplay,
                installmentDueDateIso: dueIso,
                installmentDueDateFormatted: dueFormatted,
            } as const;

            switch (action) {
                case "installment_remind_3d":
                    if (diff < 3) throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
                    payload = {...instCommon, kind: "installment_reminder", reminderPhase: "3"};
                    break;
                case "installment_remind_1d":
                    if (diff < 1) throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
                    payload = {...instCommon, kind: "installment_reminder", reminderPhase: "1"};
                    break;
                case "installment_remind_today":
                    if (diff !== 0 || past) throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
                    payload = {...instCommon, kind: "installment_reminder", reminderPhase: "0"};
                    break;
                case "installment_remind_remaining_days":
                    if (past || diff < 0) throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
                    payload = {...instCommon, kind: "installment_remaining_days", daysRemaining: diff};
                    break;
                case "installment_send_overdue":
                    if (!past) throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
                    payload = {...instCommon, kind: "installment_overdue"};
                    break;
                default:
                    throw apiValidationException("manual_sale_email_action_not_allowed", "", null, languageCode);
            }
        }

        const sent = await dispatchSaleClientEmail(payload);
        if (!sent) {
            throw apiValidationException("client_has_no_email", "", null, languageCode);
        }

        logger.finish(`Manual sale client email sent: ${action} for ${_id}`);
        return {ok: true};
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: payInstallmentFormSchema,
    })
    async payInstallment(params: Record<string, any>): Promise<PaymentPlanData | undefined> {
        const {logger, languageCode, session, _id, installmentNumber, paidAmount, transactionId, notes, actionUserCtx, company} = params;

        logger.start(`Recording payment for installment ${installmentNumber} of payment plan: ${_id}...`);
        SchemaGuard.sanitizeFields(PaymentPlan, {installments: {keys: {status: {}}}}, "write", actionUserCtx, languageCode);

        const existingPlan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        const sale = await saleService.findOneOrThrow(
            {_id: existingPlan.sale, company: company._id},
            {session, logger, languageCode},
            [{path: "saleCurrency", select: "symbol name"}],
        );
        await unitService.findOneOrThrow(
            {_id: sale.unit, company: company._id},
            {session, logger, languageCode},
        );

        const installment = existingPlan.installments.find((inst: any) => inst.installmentNumber === installmentNumber);
        if (!installment) {
            throw apiValidationException("installment_not_found", null, null, languageCode);
        }

        const currentPaid = installment.paidAmount
            ? typeof installment.paidAmount === "object"
                ? parseFloat(installment.paidAmount.toString())
                : installment.paidAmount
            : 0;
        const newPaidAmount = currentPaid + paidAmount;
        const installmentAmount =
            typeof installment.amount === "object" ? parseFloat(installment.amount.toString()) : installment.amount;

        installment.paidAmount = Decimal128.fromString(newPaidAmount.toString());
        const receiptPaidDate = new Date();
        if (newPaidAmount >= installmentAmount) {
            installment.status = InstallmentStatus.PAID;
            installment.paidDate = receiptPaidDate;
        } else if (newPaidAmount > 0) {
            installment.status = InstallmentStatus.PARTIALLY_PAID;
        }
        if (transactionId) installment.transactionId = transactionId;
        if (notes) installment.notes = notes;

        const receipt: any = {amount: Decimal128.fromString(paidAmount.toString()), paidDate: receiptPaidDate};
        if (transactionId) receipt.transactionId = transactionId;
        if (notes) receipt.notes = notes;
        if (!Array.isArray((installment as any).paymentReceipts)) (installment as any).paymentReceipts = [];
        (installment as any).paymentReceipts.push(receipt);

        const allPaid = existingPlan.installments.every((inst: any) => inst.status === InstallmentStatus.PAID);
        if (allPaid && existingPlan.downPaymentPaid) {
            existingPlan.status = PaymentPlanStatus.COMPLETED;
        }

        existingPlan.$locals = existingPlan.$locals || {};
        existingPlan.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await existingPlan.save({session});

        let returnPaymentPlan: PaymentPlanData | undefined;
        try {
            const readSanitizedFields = SchemaGuard.sanitizeFields(
                PaymentPlan,
                getModelCollectedData("paymentplans").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readSanitizedFields, PaymentPlan.schema);
            const updated = await paymentPlanService.findById(existingPlan._id, {session, logger, languageCode}, populate.populate);
            returnPaymentPlan = paymentPlanToDTO(updated);
        } catch {
            logger.debug("User has no read permission on payment plan!");
        }

        const buyerId = (sale.buyer as any)?._id?.toString() ?? sale.buyer?.toString();
        if (buyerId) {
            emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_INSTALLMENT_PAID, {
                receiverIds: [buyerId],
                payload: {
                    companyId: company._id.toString(),
                    paymentPlanId: existingPlan._id.toString(),
                    saleId: existingPlan.sale?.toString(),
                    installmentNumber,
                    paidAmount: paidAmount?.toString(),
                    currencySymbol: (sale.saleCurrency as any)?.symbol,
                    remainingBalance: existingPlan.remainingBalance?.toString(),
                    languageCode: languageCode ?? "en-US",
                },
            });

            if (existingPlan.status === PaymentPlanStatus.COMPLETED) {
                emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_COMPLETED, {
                    receiverIds: [buyerId],
                    payload: {
                        companyId: company._id.toString(),
                        paymentPlanId: existingPlan._id.toString(),
                        saleId: existingPlan.sale?.toString(),
                        totalAmount: existingPlan.totalAmount?.toString(),
                        currencySymbol: (sale.saleCurrency as any)?.symbol,
                        languageCode: languageCode ?? "en-US",
                    },
                });
            }
        }

        if (existingPlan.status === PaymentPlanStatus.DEFAULTED) {
            const soldById = (sale.soldBy as any)?._id?.toString() ?? sale.soldBy?.toString();
            const notifyIds = [soldById].filter(Boolean) as string[];
            if (notifyIds.length) {
                emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_DEFAULTED, {
                    receiverIds: notifyIds,
                    payload: {
                        companyId: company._id.toString(),
                        paymentPlanId: existingPlan._id.toString(),
                        saleId: existingPlan.sale?.toString(),
                        planName: existingPlan.name,
                        languageCode: languageCode ?? "en-US",
                    },
                });
            }
        }

        logger.finish(`Successfully recorded payment for installment ${installmentNumber}`);
        return returnPaymentPlan;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async payDownPayment(params: Record<string, any>): Promise<PaymentPlanData | undefined> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params;

        logger.start(`Recording down payment for payment plan: ${_id}...`);
        SchemaGuard.sanitizeFields(PaymentPlan, {downPaymentPaid: {}, downPaymentDate: {}}, "write", actionUserCtx, languageCode);

        const existingPlan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        const sale = await saleService.findOneOrThrow(
            {_id: existingPlan.sale, company: company._id},
            {session, logger, languageCode},
            [{path: "saleCurrency", select: "symbol name"}],
        );
        await unitService.findOneOrThrow(
            {_id: sale.unit, company: company._id},
            {session, logger, languageCode},
        );

        existingPlan.downPaymentPaid = true;
        if (!existingPlan.downPaymentDate) existingPlan.downPaymentDate = new Date();

        const allInstallmentsPaid = existingPlan.installments.every(
            (inst: any) => inst.status === InstallmentStatus.PAID,
        );
        if (allInstallmentsPaid && existingPlan.downPaymentPaid) {
            existingPlan.status = PaymentPlanStatus.COMPLETED;
        }

        existingPlan.$locals = existingPlan.$locals || {};
        existingPlan.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await existingPlan.save({session});

        let returnPaymentPlan: PaymentPlanData | undefined;
        try {
            const readSanitizedFields = SchemaGuard.sanitizeFields(
                PaymentPlan,
                getModelCollectedData("paymentplans").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readSanitizedFields, PaymentPlan.schema);
            const updated = await paymentPlanService.findById(existingPlan._id, {session, logger, languageCode}, populate.populate);
            returnPaymentPlan = paymentPlanToDTO(updated);
        } catch {
            logger.debug("User has no read permission on payment plan!");
        }

        const downPaymentBuyerId = (sale.buyer as any)?._id?.toString() ?? sale.buyer?.toString();
        if (downPaymentBuyerId) {
            emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_DOWN_PAYMENT_PAID, {
                receiverIds: [downPaymentBuyerId],
                payload: {
                    companyId: company._id.toString(),
                    paymentPlanId: existingPlan._id.toString(),
                    saleId: existingPlan.sale?.toString(),
                    downPayment: existingPlan.downPayment?.toString(),
                    currencySymbol: (sale.saleCurrency as any)?.symbol,
                    remainingBalance: existingPlan.remainingBalance?.toString(),
                    languageCode: languageCode ?? "en-US",
                },
            });

            if (existingPlan.status === PaymentPlanStatus.COMPLETED) {
                emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_COMPLETED, {
                    receiverIds: [downPaymentBuyerId],
                    payload: {
                        companyId: company._id.toString(),
                        paymentPlanId: existingPlan._id.toString(),
                        saleId: existingPlan.sale?.toString(),
                        totalAmount: existingPlan.totalAmount?.toString(),
                        currencySymbol: (sale.saleCurrency as any)?.symbol,
                        languageCode: languageCode ?? "en-US",
                    },
                });
            }
        }

        logger.finish(`Successfully recorded down payment for payment plan: ${_id}`);
        return returnPaymentPlan;
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        transaction: true,
        schema: restructurePaymentPlanFormSchema,
    })
    async restructurePaymentPlan(params: Record<string, any>): Promise<PaymentPlanData> {
        const {logger, languageCode, session, _id, installments: newSchedule, startDate, endDate, interestRate, reason, actionUserCtx, company} = params;

        logger.start(`Restructuring payment plan: ${_id}...`);
        // SchemaGuard.checkModelPermission(PaymentPlan, "write", actionUserCtx, languageCode); //TODO check this too !important

        const existingPlan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id, status: PaymentPlanStatus.ACTIVE},
            {session, logger, languageCode},
        );

        const scheduleInputs: PaymentPlanInstallmentScheduleInput[] = newSchedule.map((inst: any) => ({
            installmentNumber: inst.installmentNumber,
            dueDate:           parseIsoDatePrefix(inst.dueDate),
            amount:            parseMoneyInput(inst.amount),
            notes:             inst.notes,
        }));

        const allocation = allocatePaymentPlanContractInterest({
            financedPrincipal: parseFloat(existingPlan.totalAmount.toString()) - parseFloat(existingPlan.downPayment.toString()),
            annualRatePercent: interestRate ?? existingPlan.interestRate ?? 0,
            planStartDate:     parseIsoDatePrefix(startDate),
            planEndDate:       parseIsoDatePrefix(endDate),
            rows:              scheduleInputs,
        });
        if (!allocation.ok) {
            throw apiValidationException(
                allocation.code === "installment_too_small"
                    ? "payment_plan_installment_too_small"
                    : "payment_plan_schedule_invalid",
                "",
                null,
                languageCode,
            );
        }

        const newInstallments: any[] = allocation.installments.map((row) => ({
            installmentNumber: row.installmentNumber,
            dueDate:           new Date(`${row.dueDate}T00:00:00.000Z`),
            amount:            Decimal128.fromString(row.amount.toString()),
            principalAmount:   Decimal128.fromString(row.principalAmount.toString()),
            interestAmount:    Decimal128.fromString(row.interestAmount.toString()),
            status:            InstallmentStatus.PENDING,
            notes:             row.notes || "",
        }));

        const totalInstallmentAmount = allocation.installments.reduce((sum, r) => sum + r.amount, 0);
        const newRemainingBalance = computePaymentPlanRemainingBalance({
            totalAmount:     existingPlan.totalAmount,
            downPayment:     existingPlan.downPayment,
            downPaymentPaid: existingPlan.downPaymentPaid as boolean,
            installments:    newInstallments,
        });

        const historyEntry = {
            restructuredAt:               new Date(),
            restructuredBy:               new ObjectId(actionUserCtx.userId),
            reason:                       reason?.trim() || undefined,
            previousNumberOfInstallments: existingPlan.numberOfInstallments,
            previousStartDate:            existingPlan.startDate,
            previousEndDate:              existingPlan.endDate,
            previousInterestRate:         existingPlan.interestRate,
            previousInstallments:         (existingPlan.installments ?? []).map((i: any) => ({...i.toObject?.() ?? i})),
        };

        await paymentPlanService.updateByIdOrThrow(
            existingPlan._id,
            {
                $set: {
                    installments:         newInstallments,
                    numberOfInstallments: newInstallments.length,
                    installmentAmount:    Decimal128.fromString(totalInstallmentAmount.toString()),
                    remainingBalance:     Decimal128.fromString(newRemainingBalance.toString()),
                    startDate:            new Date(`${parseIsoDatePrefix(startDate)}T00:00:00.000Z`),
                    endDate:              new Date(`${parseIsoDatePrefix(endDate)}T00:00:00.000Z`),
                    ...(interestRate !== undefined && {interestRate}),
                },
                $push: {restructureHistory: historyEntry},
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const updated = await paymentPlanService.findById(existingPlan._id, {session, logger, languageCode});
        logger.finish(`Payment plan restructured: ${_id} → ${newInstallments.length} new installments`);
        return paymentPlanToDTO(updated);
    }
}
