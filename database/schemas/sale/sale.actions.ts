import {ObjectId, Decimal128} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {approveSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/approveSale.form.validator";
import {manualSaleClientEmailFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/manualSaleClientEmail.form.validator";
import {payInstallmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/payInstallment.form.validator";
import {restructurePaymentPlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/restructurePaymentPlan.form.validator";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {recordTitleTransferFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/recordTitleTransfer.form.validator";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {companyTimeZone, companyTodayOf} from "@coreModule/utilities/time/companyTimeZone";
import {
    assertTitleTransferAllowed,
    salesWithHandoverContext,
} from "@propertyManagement/utilities/handoverPackage/handoverPackageChecklist";
import Sale, {SaleApprovalStatus, SalePaymentType} from "./sale";
import PaymentPlan, {
    computePaymentPlanRemainingBalance,
    InstallmentStatus,
    type IPaymentPlan,
    type IPaymentPlanInstallment,
    PaymentPlanStatus,
} from "../paymentPlan/paymentPlan";
import {releaseSale} from "./sale.helper";
import {saleService} from "./sale.service";
import {unitService} from "../unit/unit.service";
import {paymentPlanService} from "../paymentPlan/paymentPlan.service";
import {saleToDTO} from "@propertyManagement/utilities/mappers/sale/saleMapper.dto";
import {paymentPlanToDTO} from "@propertyManagement/utilities/mappers/paymentPlan/paymentPlanMapper.dto";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
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
    paymentPlanScheduleErrorKey,
    type PaymentPlanInstallmentScheduleInput,
} from "@propertyManagement/utilities/sale/paymentPlanContractInterest";
import {calendarDaysUntil, isCalendarDayOver} from "@propertyManagement/utilities/reservation/reservationExpirationCalendar";
import {
    formatDiscountForEmail,
    formatMoneyAmountForEmail,
    UNIT_EMAIL_POPULATE,
    UNIT_EMAIL_SELECT,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import type {ManualSaleClientEmailForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/manualSaleClientEmail.form.type";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {notifySalesWatchers} from "@propertyManagement/utilities/sale/salesStaffNotify";
import {salePlanSummaryForEmail} from "@propertyManagement/utilities/emails/salePlanSummaryForEmail";
import {minorToNumber, sumMinor, toMinor} from "armonia/src/modules/core/helpers/money";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";

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
        const pcDoc = pcid ? await currencyService.findOne({_id: new ObjectId(pcid)}) : undefined;
        const sym = pcDoc?.symbol ?? "";
        const amt = formatMoneyAmountForEmail(foundUnit.price.toString(), languageCode);
        return sym ? `${amt} ${sym}` : amt;
    } catch {
        return undefined;
    }
}

/** Id of a possibly-populated ref. */
function idOfRef(ref: unknown): ObjectId | undefined {
    if (ref instanceof ObjectId) return ref;
    const id = (ref as {_id?: unknown} | null | undefined)?._id;
    return id instanceof ObjectId ? id : undefined;
}

/** Payments go only to a plan still running: active, or defaulted with overdue installments to catch up on. */
function assertPlanTakesPayments(plan: IPaymentPlan, languageCode: string): void {
    if (plan.status !== PaymentPlanStatus.ACTIVE && plan.status !== PaymentPlanStatus.DEFAULTED) {
        throw apiValidationException("payment_plan_not_open", "", null, languageCode);
    }
}

/** A row with money on it stays as it is when the plan is restructured: its payments and receipts are history. */
function installmentHasPayments(installment: IPaymentPlanInstallment): boolean {
    return installment.status === InstallmentStatus.PAID || toMinor(installment.paidAmount) > 0n;
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

        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (sale.approvalStatus !== SaleApprovalStatus.PENDING_APPROVAL) {
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
            await releaseSale(sale, {session, logger, languageCode, actionUserCtx, companyId: company._id});
        }

        const soldById = nestedEntityToRef(sale.soldBy)?.toString();
        const buyerId = nestedEntityToRef(sale.buyer)?.toString();

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

    /** Re-sends the "new sale" alert to the Sales & handover → Notify on sales list. */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        schema: validateSingleForm,
    })
    async resendStaffNotifications(params: Record<string, any>): Promise<{ok: true; recipients: number}> {
        const {logger, languageCode, _id, actionUserCtx, company} = params;

        logger.start(`Resending staff notifications for sale: ${_id}`);
        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            [
                {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
                {path: "saleCurrency", select: "symbol"},
            ],
        );
        if (sale.deletedAt) {
            throw apiValidationException("sale_not_found", "", null, languageCode);
        }

        const lang = languageCode ?? "en-US";
        const saleSym = (sale.saleCurrency as {symbol?: string} | undefined)?.symbol;
        const unitRef = sale.unit as
            | {
                  _id?: ObjectId;
                  unitNumber?: string | number;
                  name?: string;
                  price?: Decimal128;
                  priceCurrency?: {symbol?: string};
                  floor?: {name?: string};
                  edifice?: {name?: string};
                  project?: {name?: string};
              }
            | undefined;
        const idOf = (ref: unknown) =>
            ref instanceof ObjectId ? ref.toString() : (ref as {_id?: ObjectId} | undefined)?._id?.toString();

        const recipients = await notifySalesWatchers({
            companyId: company._id,
            companyName: company.name ?? "",
            languageCode: lang,
            saleId: sale._id.toString(),
            saleCode: sale.name,
            pendingApproval: sale.approvalStatus === SaleApprovalStatus.PENDING_APPROVAL,
            finalPriceDisplay: finalPriceDisplayForEmail(sale.finalPrice, saleSym, lang),
            unitPriceDisplay: unitRef?.price != null ? finalPriceDisplayForEmail(unitRef.price, unitRef.priceCurrency?.symbol, lang) : undefined,
            localDiscountDisplay: formatDiscountForEmail(sale.localDiscount, unitRef?.price, unitRef?.priceCurrency?.symbol, lang),
            ...await salePlanSummaryForEmail({
                paymentPlanId: sale.paymentType === SalePaymentType.PAYMENT_PLAN ? idOfRef(sale.paymentPlan) : undefined,
                companyId: company._id,
                currencySymbol: saleSym,
                languageCode: lang,
            }),
            paymentType: sale.paymentType === SalePaymentType.PAYMENT_PLAN ? "payment_plan" : "cash",
            buyerId: idOf(sale.buyer),
            soldById: idOf(sale.soldBy),
            unitId: idOf(sale.unit) ?? "",
            unitNumber: unitRef?.unitNumber != null ? String(unitRef.unitNumber) : undefined,
            unitDisplayName: unitRef?.name,
            ...unitLocationForEmail(unitRef),
        });
        if (!recipients) {
            throw apiValidationException("no_notification_recipients", "", null, languageCode);
        }

        logger.finish(`Resent sale staff notifications to ${recipients} user(s)`);
        return {ok: true, recipients};
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

        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            [
                {path: "buyer", select: "username name surname fullName"},
                {path: "unit", select: UNIT_EMAIL_SELECT, populate: UNIT_EMAIL_POPULATE},
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
            | {
                  unitNumber?: string | number;
                  name?: string;
                  price?: Decimal128;
                  priceCurrency?: {symbol?: string};
                  floor?: {name?: string; levelNumber?: number};
                  edifice?: {name?: string};
                  project?: {name?: string};
              }
            | undefined;
        const unitNumber = unitRef?.unitNumber != null ? String(unitRef.unitNumber) : undefined;
        const unitDisplayName = unitRef?.name;
        const location = unitLocationForEmail(unitRef);
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
            ...location,
            unitPriceDisplay,
            localDiscountDisplay: formatDiscountForEmail(
                sale.localDiscount,
                unitRef?.price,
                unitRef?.priceCurrency?.symbol,
                languageCode ?? "en-US",
            ),
            finalPriceDisplay,
        } as const;

        const lang = languageCode ?? "en-US";
        let payload: DispatchSaleClientEmailInput;

        if (action === "send_sale_confirmation") {
            const planSummary = await salePlanSummaryForEmail({
                paymentPlanId: paymentType === "payment_plan" ? idOfRef(sale.paymentPlan) : undefined,
                companyId: company._id,
                currencySymbol: saleSym,
                languageCode: lang,
            });
            payload = {
                ...base,
                kind: "sale_created",
                ...planSummary,
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
            const due: string = inst.dueDate;
            const dueIso = due;
            const dueFormatted = formatInstallmentDueDateForEmail(dueIso, lang);
            const instAmt = formatMoneyAmountForEmail(inst.amount.toString(), lang);
            const installmentAmountDisplay = saleSym ? `${instAmt} ${saleSym}` : instAmt;
            const today = await companyTodayOf(company._id);
            const past = isCalendarDayOver(due, today);
            const diff = calendarDaysUntil(due, today);

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

        const existingPlan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        const sale = await saleService.findOneOrThrow(
            {_id: existingPlan.sale, company: company._id},
            {session, logger, languageCode},
            [{path: "saleCurrency", select: "symbol name decimalPlaces"}],
        );
        await unitService.findOneOrThrow(
            {_id: sale.unit, company: company._id},
            {session, logger, languageCode},
        );
        // The plan's money is in the sale currency, exact at its decimals (D35).
        const decimals = sale.saleCurrency?.decimalPlaces;

        assertPlanTakesPayments(existingPlan, languageCode);
        const installment = existingPlan.installments.find((inst) => inst.installmentNumber === installmentNumber);
        if (!installment) {
            throw apiValidationException("installment_not_found", null, null, languageCode);
        }
        if (installment.status === InstallmentStatus.PAID || installment.status === InstallmentStatus.CANCELLED) {
            throw apiValidationException("installment_already_paid", "", null, languageCode);
        }

        const newPaidMinor = sumMinor([toMinor(installment.paidAmount, decimals), toMinor(paidAmount, decimals)]);
        const amountMinor = toMinor(installment.amount, decimals);
        // Paying beyond the installment is refused (D121); a late fee is owed information, never part of the amount due.
        if (newPaidMinor > amountMinor) {
            throw apiValidationException("installment_payment_exceeds_due", "", null, languageCode);
        }

        installment.paidAmount = decimal128FromMinor(newPaidMinor, decimals);
        const receiptPaidDate = localDateOf(new Date(), companyTimeZone(company));
        if (newPaidMinor === amountMinor) {
            installment.status = InstallmentStatus.PAID;
            installment.paidDate = receiptPaidDate;
        } else if (newPaidMinor > 0n && installment.status !== InstallmentStatus.OVERDUE) {
            // A part payment does not catch up an overdue installment: it stays overdue until it is paid in full.
            installment.status = InstallmentStatus.PARTIALLY_PAID;
        }
        if (transactionId) installment.transactionId = transactionId;
        if (notes) installment.notes = notes;

        installment.paymentReceipts = [
            ...(installment.paymentReceipts ?? []),
            {
                amount: decimal128FromMinor(toMinor(paidAmount, decimals), decimals),
                paidDate: receiptPaidDate,
                ...(transactionId ? {transactionId} : {}),
                ...(notes ? {notes} : {}),
            },
        ];

        const allPaid = existingPlan.installments.every((inst) => inst.status === InstallmentStatus.PAID);
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

        const buyerId = nestedEntityToRef(sale.buyer)?.toString();
        if (buyerId) {
            emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_INSTALLMENT_PAID, {
                receiverIds: [buyerId],
                payload: {
                    companyId: company._id.toString(),
                    paymentPlanId: existingPlan._id.toString(),
                    saleId: existingPlan.sale?.toString(),
                    installmentNumber,
                    paidAmount: paidAmount?.toString(),
                    currencySymbol: sale.saleCurrency?.symbol,
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
                        currencySymbol: sale.saleCurrency?.symbol,
                        languageCode: languageCode ?? "en-US",
                    },
                });
            }
        }

        if (existingPlan.status === PaymentPlanStatus.DEFAULTED) {
            const soldById = nestedEntityToRef(sale.soldBy)?.toString();
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

        assertPlanTakesPayments(existingPlan, languageCode);
        if (existingPlan.downPaymentPaid) {
            throw apiValidationException("down_payment_already_paid", "", null, languageCode);
        }

        existingPlan.downPaymentPaid = true;
        if (!existingPlan.downPaymentDate) existingPlan.downPaymentDate = localDateOf(new Date(), companyTimeZone(company));

        const allInstallmentsPaid = existingPlan.installments.every(
            (inst) => inst.status === InstallmentStatus.PAID,
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

        const downPaymentBuyerId = nestedEntityToRef(sale.buyer)?.toString();
        if (downPaymentBuyerId) {
            emitNotificationEvent(NotificationEventCodes.PAYMENT_PLAN_DOWN_PAYMENT_PAID, {
                receiverIds: [downPaymentBuyerId],
                payload: {
                    companyId: company._id.toString(),
                    paymentPlanId: existingPlan._id.toString(),
                    saleId: existingPlan.sale?.toString(),
                    downPayment: existingPlan.downPayment?.toString(),
                    currencySymbol: sale.saleCurrency?.symbol,
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
                        currencySymbol: sale.saleCurrency?.symbol,
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

        // A defaulted plan is restructured too: that is how its arrears get a new schedule.
        const existingPlan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id, status: {$in: [PaymentPlanStatus.ACTIVE, PaymentPlanStatus.DEFAULTED]}},
            {session, logger, languageCode},
        );

        // The plan has no currency of its own: its money is in the sale currency, exact at its decimals (D35).
        const sale = await saleService.findOneOrThrow(
            {_id: existingPlan.sale, company: company._id},
            {session, logger, languageCode},
            [{path: "saleCurrency", select: "decimalPlaces"}],
        );
        const decimals = sale.saleCurrency?.decimalPlaces;

        // Rows with payments stay; the new schedule re-plans only the principal they do not carry, numbered after them.
        const keptInstallments = existingPlan.installments.filter(installmentHasPayments);
        const unpaidPrincipalMinor = toMinor(existingPlan.totalAmount, decimals) - toMinor(existingPlan.downPayment, decimals)
            - sumMinor(keptInstallments.map((inst) => toMinor(inst.principalAmount, decimals)));
        const firstNewNumber = Math.max(0, ...keptInstallments.map((inst) => inst.installmentNumber)) + 1;

        const scheduleInputs: PaymentPlanInstallmentScheduleInput[] = newSchedule.map((inst: any, index: number) => ({
            installmentNumber: firstNewNumber + index,
            dueDate:           parseIsoDatePrefix(inst.dueDate),
            amount:            parseMoneyInput(inst.amount, decimals),
            notes:             inst.notes,
        }));

        const allocation = allocatePaymentPlanContractInterest({
            decimals,
            financedPrincipal: minorToNumber(unpaidPrincipalMinor, decimals),
            annualRatePercent: interestRate ?? existingPlan.interestRate ?? 0,
            planStartDate:     parseIsoDatePrefix(startDate),
            planEndDate:       parseIsoDatePrefix(endDate),
            rows:              scheduleInputs,
        });
        if (!allocation.ok) throw apiValidationException(paymentPlanScheduleErrorKey(allocation.code), "", null, languageCode);

        const newInstallments = [
            ...keptInstallments,
            ...allocation.installments.map((row) => ({
                installmentNumber: row.installmentNumber,
                dueDate:           row.dueDate,
                amount:            decimal128FromMinor(toMinor(row.amount, decimals), decimals),
                principalAmount:   decimal128FromMinor(toMinor(row.principalAmount, decimals), decimals),
                interestAmount:    decimal128FromMinor(toMinor(row.interestAmount, decimals), decimals),
                status:            InstallmentStatus.PENDING,
                notes:             row.notes || "",
            })),
        ];

        const totalInstallmentMinor = sumMinor(newInstallments.map((inst) => toMinor(inst.amount, decimals)));
        const newRemainingBalance = computePaymentPlanRemainingBalance({
            downPayment:     existingPlan.downPayment,
            downPaymentPaid: existingPlan.downPaymentPaid,
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
                    // The new rows are pending; the plan stays defaulted only while a kept row is still overdue.
                    status:               keptInstallments.some((inst) => inst.status === InstallmentStatus.OVERDUE)
                        ? PaymentPlanStatus.DEFAULTED
                        : PaymentPlanStatus.ACTIVE,
                    numberOfInstallments: newInstallments.length,
                    installmentAmount:    decimal128FromMinor(totalInstallmentMinor, decimals),
                    remainingBalance:     Decimal128.fromString(newRemainingBalance.toString()),
                    // With paid rows kept, the plan still starts where it started.
                    ...(keptInstallments.length === 0 && {startDate: parseIsoDatePrefix(startDate)}),
                    endDate:              parseIsoDatePrefix(endDate),
                    ...(interestRate !== undefined && {interestRate}),
                },
                $push: {restructureHistory: historyEntry},
            },
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const updated = await paymentPlanService.findById(existingPlan._id, {session, logger, languageCode});
        logger.finish(`Payment plan restructured: ${_id} → ${allocation.installments.length} new installments after ${keptInstallments.length} kept`);
        return paymentPlanToDTO(updated);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        transaction: true,
        middleware: [mediaUploadMW({fields: {titleTransferCertificate: 1}, maxFileSize: 100 * 1024 * 1024})],
        schema: recordTitleTransferFormSchema,
    })
    async recordTitleTransfer(params: Record<string, any>): Promise<SaleData | undefined> {
        const {
            logger, languageCode, session, _id, actionUserCtx, company,
            titleTransferDate, deedNumber, notaryName, titleTransferCertificate,
        } = params;

        logger.start(`Recording title transfer for sale: ${_id}...`);

        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (sale.deletedAt) {
            throw apiValidationException("sale_not_found", "", null, languageCode);
        }

        await assertTitleTransferAllowed(sale, company._id, {session, logger, languageCode});

        const certificateRaw = Array.isArray(titleTransferCertificate) ? titleTransferCertificate[0] : titleTransferCertificate;
        const $set: Record<string, unknown> = {
            titleTransferDate,
        };
        if (typeof deedNumber === "string" && deedNumber.trim() !== "") $set.deedNumber = deedNumber.trim();
        if (typeof notaryName === "string" && notaryName.trim() !== "") $set.notaryName = notaryName.trim();
        if (certificateRaw) $set.titleTransferCertificate = new ObjectId(certificateRaw.toString());

        await saleService.updateByIdOrThrow(
            sale._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

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
            if (updated) {
                const [enriched] = await salesWithHandoverContext([updated], {company, session, logger, languageCode});
                returnSale = enriched;
            }
        } catch {
            logger.debug("User has no read permission on sale after recording title transfer!");
        }

        logger.finish(`Title transfer recorded: ${_id}`);
        return returnSale;
    }
}
