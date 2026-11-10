/**
 * Selling a unit (BE-01: a flow across sale, payment plan, unit, reservation and commission). The sale router's
 * create hooks are thin entry points: `buildSaleCreateData` checks the unit, prices the sale and creates its payment
 * plan; once the sale exists, `completeSaleCreation` marks the unit sold, converts its reservation, links the plan,
 * records the commission, asks for approval when the company requires it, and tells the buyer and the sales watchers.
 */
import {Decimal128, ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {addMoney, fromMinor, minorToNumber, toMinor} from "armonia/src/modules/core/helpers/money";
import {computeSalePricing} from "armonia/src/modules/propertyManagement/helpers/salePricing";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import type {CreateSaleFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/createSale.form.type";
import type {CrudCreateParams} from "@coreModule/api/crudRouterFactory";
import type {CrudOptions} from "@coreModule/database/services/baseCrudService";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import type {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {userService} from "@coreModule/database/schemas/user/user.service";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {decimalToNumber, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {CommissionSourceType} from "../database/schemas/commission/commission";
import {recordCommission} from "../database/schemas/commission/commission.helper";
import {computePaymentPlanRemainingBalance, InstallmentStatus, PaymentPlanStatus} from "../database/schemas/paymentPlan/paymentPlan";
import {paymentPlanService} from "../database/schemas/paymentPlan/paymentPlan.service";
import {propertyManagementConfigService} from "../database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {ReservationStatus} from "../database/schemas/reservation/reservation";
import {reservationService} from "../database/schemas/reservation/reservation.service";
import {type ISale, SaleApprovalStatus, SalePaymentType} from "../database/schemas/sale/sale";
import {saleService} from "../database/schemas/sale/sale.service";
import type {IUnit} from "../database/schemas/unit/unit";
import {unitService} from "../database/schemas/unit/unit.service";
import {dispatchSaleClientEmail} from "../utilities/database/sale/saleClientEmailDispatch";
import {
    formatDiscountForEmail,
    formatMoneyAmountForEmail,
    UNIT_EMAIL_POPULATE,
    unitLocationForEmail,
} from "../utilities/emails/reservationEmailFormatting";
import {salePlanSummaryForEmail} from "../utilities/emails/salePlanSummaryForEmail";
import {
    allocatePaymentPlanContractInterest,
    parseIsoDatePrefix,
    parseMoneyInput,
    paymentPlanScheduleErrorKey,
    type PaymentPlanInstallmentScheduleInput,
} from "../utilities/sale/paymentPlanContractInterest";
import {notifySalesWatchers} from "../utilities/sale/salesStaffNotify";

/** The sale router's create params: the caller, the open transaction and the validated create body. */
export type SaleCreationParams = CrudCreateParams<CreateSaleFormType>;

function purchaseContractMediaIdFromFormValue(v: unknown): string | undefined {
    const s = Array.isArray(v) ? v[0] : v;
    const t = s != null ? String(s).trim() : "";
    return t !== "" ? t : undefined;
}

async function unitPriceCurrencySymbolForEmail(unit: IUnit, companyId: ObjectId): Promise<string | undefined> {
    try {
        const pcid = nestedEntityToRef(unit.priceCurrency);
        const pcDoc = pcid ? await currencyService.findOne({_id: pcid, company: companyId}) : undefined;
        return pcDoc?.symbol || undefined;
    } catch {
        return undefined;
    }
}

function finalPriceDisplayForEmail(finalPrice: number | undefined, currencySymbol: string | undefined, languageCode: string): string | undefined {
    if (finalPrice == null) return undefined;
    const amt = formatMoneyAmountForEmail(String(finalPrice), languageCode);
    return currencySymbol ? `${amt} ${currencySymbol}` : amt;
}

/** An exchange rate as posted, when it is a positive number. */
function positiveRate(value: unknown): string | undefined {
    const text = value == null ? "" : String(value).trim();
    return text !== "" && Number(text) > 0 ? text : undefined;
}

/**
 * The sale's final price by the shared rule (armonia `computeSalePricing`, also the sale forms' preview, D35): the
 * discounted list price converted to the sale currency, less the reservation deposit converted from its currency.
 * A rate is needed, and stored, only where the two currencies differ.
 */
async function priceUnitSale(
    foundUnit: IUnit,
    saleCurrency: ICurrency,
    form: {localDiscount?: number; saleExchangeRate?: unknown; reservationExchangeRate?: unknown},
    companyId: ObjectId,
    opts: CrudOptions & {languageCode: string},
) {
    const {languageCode} = opts;
    const unitCurrencyId = nestedEntityToRef(foundUnit.priceCurrency);
    const reservation = foundUnit.reservation;
    const depositCurrencyId = reservation ? nestedEntityToRef(reservation.depositCurrency) : undefined;

    // The deposit is deducted from the price, so it must have been received and be known.
    if (reservation && !reservation.paid) throw apiValidationException("unit_already_reserved_and_unpaid", "", null, languageCode);
    if (reservation && (!reservation.depositAmount || !depositCurrencyId)) {
        throw apiValidationException("reservation_deposit_data_missing", "", null, languageCode);
    }

    const saleExchangeRate = unitCurrencyId?.equals(saleCurrency._id) ? undefined : positiveRate(form.saleExchangeRate);
    if (!unitCurrencyId?.equals(saleCurrency._id) && !saleExchangeRate) {
        throw apiValidationException("sale_exchange_rate_required", "", null, languageCode);
    }
    const reservationExchangeRate = !depositCurrencyId || depositCurrencyId.equals(saleCurrency._id)
        ? undefined
        : positiveRate(form.reservationExchangeRate);
    if (depositCurrencyId && !depositCurrencyId.equals(saleCurrency._id) && !reservationExchangeRate) {
        throw apiValidationException("reservation_exchange_rate_required", "", null, languageCode);
    }

    const currencyIds = [unitCurrencyId, depositCurrencyId].filter((id): id is ObjectId => id !== undefined);
    const currencies = await currencyService.find({_id: {$in: currencyIds}, company: companyId}, opts, undefined, "decimalPlaces");
    const decimalsOf = (id: ObjectId | undefined) => currencies.find((currency) => id?.equals(currency._id))?.decimalPlaces;

    const pricing = computeSalePricing({
        unitPrice: foundUnit.price,
        unitDecimals: decimalsOf(unitCurrencyId),
        discountPercent: form.localDiscount,
        saleExchangeRate,
        saleDecimals: saleCurrency.decimalPlaces,
        depositAmount: reservation?.depositAmount,
        depositDecimals: decimalsOf(depositCurrencyId),
        reservationExchangeRate,
    });
    if (!pricing.ok) throw apiValidationException("final_price_cannot_be_negative", "", null, languageCode);
    return {...pricing, saleExchangeRate, reservationExchangeRate};
}

/**
 * The payment plan of a sale on installments, created before the sale (its `sale` is linked once the sale exists).
 * Amounts are exact at the sale currency's decimals (D35); a schedule that does not pay the financed amount and its
 * contract interest exactly, or asks for more, is refused (D121).
 */
async function createSalePaymentPlan(
    params: SaleCreationParams,
    pricing: {finalPriceMinor: bigint},
    saleDecimals: number | undefined,
): Promise<ObjectId> {
    const {session, logger, languageCode, company, actionUserCtx, saleDate, installments: installmentRows,
        downPayment, numberOfInstallments, startDate: startDateField, endDate: endDateField,
        interestRate, gracePeriodDays, lateFeePercentage, paymentPlanNotes, downPaymentPaid, downPaymentDate} = params;

    if (!installmentRows) throw apiValidationException("installments_required", "", null, languageCode);
    if (!installmentRows.length) throw apiValidationException("at_least_one_installment_required", "", null, languageCode);

    const downPaymentMinor = toMinor(downPayment, saleDecimals);
    if (downPaymentMinor > pricing.finalPriceMinor) throw apiValidationException("down_payment_exceeds_final_price", "", null, languageCode);

    if (numberOfInstallments !== installmentRows.length) {
        throw apiValidationException("payment_plan_installment_count_mismatch", "", null, languageCode);
    }
    if (parseIsoDatePrefix(startDateField) !== parseIsoDatePrefix(saleDate)) {
        throw apiValidationException("payment_plan_start_date_must_match_sale_date", "", null, languageCode);
    }

    const scheduleInputs: PaymentPlanInstallmentScheduleInput[] = installmentRows.map((inst, idx) => ({
        installmentNumber: Number.isFinite(inst.installmentNumber) ? Math.floor(inst.installmentNumber) : idx + 1,
        dueDate:           parseIsoDatePrefix(inst.dueDate),
        amount:            parseMoneyInput(inst.amount, saleDecimals),
        notes:             inst.notes,
    }));

    const allocation = allocatePaymentPlanContractInterest({
        decimals:          saleDecimals,
        financedPrincipal: minorToNumber(pricing.finalPriceMinor - downPaymentMinor, saleDecimals),
        annualRatePercent: interestRate ?? 0,
        planStartDate:     parseIsoDatePrefix(startDateField),
        planEndDate:       parseIsoDatePrefix(endDateField),
        rows:              scheduleInputs,
    });
    if (!allocation.ok) throw apiValidationException(paymentPlanScheduleErrorKey(allocation.code), "", null, languageCode);

    const installments = allocation.installments.map((row) => ({
        installmentNumber: row.installmentNumber,
        dueDate:           row.dueDate,
        amount:            decimal128FromMinor(toMinor(row.amount, saleDecimals), saleDecimals),
        principalAmount:   decimal128FromMinor(toMinor(row.principalAmount, saleDecimals), saleDecimals),
        interestAmount:    decimal128FromMinor(toMinor(row.interestAmount, saleDecimals), saleDecimals),
        status:            InstallmentStatus.PENDING,
        notes:             row.notes || "",
    }));

    const totalInstallmentAmount = addMoney(...allocation.installments.map((r) => r.amount));

    // Plan days are local `YYYY-MM-DD` strings (D115); without them the schedule's first and last due days.
    const startDate: string = parseIsoDatePrefix(startDateField) || installments[0].dueDate;
    const endDate: string   = parseIsoDatePrefix(endDateField)   || installments[installments.length - 1].dueDate;

    const remainingBalance = computePaymentPlanRemainingBalance({
        downPayment:     fromMinor(downPaymentMinor, saleDecimals),
        downPaymentPaid: !!downPaymentPaid,
        installments,
    });

    const paymentPlan = await paymentPlanService.create(
        {
            sale:                 new ObjectId(),
            status:               PaymentPlanStatus.ACTIVE,
            totalAmount:          decimal128FromMinor(pricing.finalPriceMinor, saleDecimals),
            downPayment:          decimal128FromMinor(downPaymentMinor, saleDecimals),
            downPaymentPaid:      !!downPaymentPaid,
            downPaymentDate:      downPaymentDate || undefined,
            remainingBalance:     Decimal128.fromString(remainingBalance.toString()),
            numberOfInstallments: installmentRows.length,
            installmentAmount:    Decimal128.fromString(totalInstallmentAmount.toString()),
            interestRate,
            startDate,
            endDate,
            installments,
            gracePeriodDays,
            lateFeePercentage,
            notes:                paymentPlanNotes || "",
            company:              company._id,
        },
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );
    return paymentPlan._id;
}

/** The sale to create: the unit must still be for sale; the price, and a payment plan when sold on one, are set. */
export async function buildSaleCreateData(params: SaleCreationParams) {
    const {
        session, logger, languageCode, company,
        paymentType, unit, soldBy, buyer, saleDate, saleCurrency,
        localDiscount, purchaseContract, additionalDocuments, notes,
        transactionReference, reservationExchangeRate, saleExchangeRate, buyerCompany,
    } = params;

    const foundUnit = await unitService.findOneOrThrow(
        {_id: new ObjectId(unit), company: company._id},
        {session, logger, languageCode},
        [{path: "reservation"}, ...UNIT_EMAIL_POPULATE],
    );

    if (foundUnit.status === UnitStatus.SOLD) throw apiValidationException("unit_already_sold", "", null, languageCode);
    if (foundUnit.status === UnitStatus.RENTED) throw apiValidationException("unit_already_rented", "", null, languageCode);
    if (foundUnit.status === UnitStatus.UNAVAILABLE) throw apiValidationException("unit_not_available", "", null, languageCode);

    const [buyerDoc, soldByDoc, saleCurrencyDoc] = await Promise.all([
        userService.findOneOrThrow({_id: new ObjectId(buyer), "roles.company": company._id}, {session, logger, languageCode}),
        userService.findOneOrThrow({_id: new ObjectId(soldBy), "roles.company": company._id}, {session, logger, languageCode}),
        currencyService.findOneOrThrow({_id: new ObjectId(saleCurrency), company: company._id}, {session, logger, languageCode}),
    ]);

    const pricing = await priceUnitSale(
        foundUnit,
        saleCurrencyDoc,
        {localDiscount, saleExchangeRate, reservationExchangeRate},
        company._id,
        {session, logger, languageCode},
    );
    const saleDecimals = saleCurrencyDoc.decimalPlaces;

    const paymentPlanId = paymentType === "payment_plan"
        ? await createSalePaymentPlan(params, pricing, saleDecimals)
        : undefined;

    const purchaseContractId = purchaseContractMediaIdFromFormValue(purchaseContract);

    return {
        unit:                       foundUnit._id,
        paymentType:                paymentType === "payment_plan" ? SalePaymentType.PAYMENT_PLAN : SalePaymentType.CASH,
        buyer:                      buyerDoc,
        buyerCompany:               buyerCompany ? new ObjectId(buyerCompany) : undefined,
        soldBy:                     soldByDoc,
        saleCurrency:               saleCurrencyDoc,
        saleDate,
        listedUnitPrice:            foundUnit.price,
        listedUnitCurrency:         foundUnit.priceCurrency,
        saleExchangeRate:           pricing.saleExchangeRate,
        localDiscount:              Decimal128.fromString(String(localDiscount ?? 0)),
        finalPrice:                 decimal128FromMinor(pricing.finalPriceMinor, saleDecimals),
        notes,
        purchaseContract:           purchaseContractId ? new ObjectId(purchaseContractId) : undefined,
        additionalDocuments:        Array.isArray(additionalDocuments) ? additionalDocuments : (additionalDocuments ? [additionalDocuments] : []),
        transactionReference,
        reservation:                foundUnit.reservation,
        reservationDepositAmount:   foundUnit.reservation?.depositAmount,
        reservationDepositCurrency: foundUnit.reservation?.depositCurrency,
        reservationExchangeRate:    pricing.reservationExchangeRate,
        reservationConvertedAmount: foundUnit.reservation ? decimal128FromMinor(pricing.depositInSaleCurrencyMinor, saleDecimals) : undefined,
        company:                    company._id,
        paymentPlan:                paymentPlanId,
    };
}

/** Everything that follows a created sale, inside its transaction; the buyer's email and the watchers' alert go out after the commit. */
export async function completeSaleCreation(created: ISale, params: SaleCreationParams): Promise<void> {
    const {session, logger, languageCode, company, actionUserCtx, paymentType, buyer, soldBy} = params;

    // The unit as it was sold, read before it is marked sold.
    const unit = await unitService.findOneOrThrow(
        {_id: nestedEntityToRef(created.unit), company: company._id},
        {session, logger, languageCode},
        UNIT_EMAIL_POPULATE,
    );
    const saleCurrencyDoc = await currencyService.findOne(
        {_id: nestedEntityToRef(created.saleCurrency), company: company._id},
        {session, logger, languageCode},
        undefined,
        "symbol",
    );
    const finalPrice = decimalToNumber(created.finalPrice) ?? 0;

    const {requiresSaleApproval: requiresApproval} = await propertyManagementConfigService.getSettingsForCompany(
        company._id,
        {session, logger, languageCode},
    );

    // Mark unit as sold
    await unitService.updateByIdOrThrow(
        unit._id,
        {$set: {status: UnitStatus.SOLD, sale: created._id}, $unset: {unavailableNotes: ""}},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );

    // Convert reservation if present
    const reservationId = nestedEntityToRef(created.reservation);
    if (reservationId) {
        try {
            await reservationService.updateByIdOrThrow(
                reservationId,
                {$set: {status: ReservationStatus.CONVERTED}},
                {session, logger, languageCode},
            );
        } catch (e: unknown) {
            logger.debug(`Failed to mark reservation as converted: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // Link payment plan back to the created sale
    const planId = paymentType === "payment_plan" ? nestedEntityToRef(created.paymentPlan) : undefined;
    if (planId) {
        await paymentPlanService.updateByIdOrThrow(
            planId,
            {$set: {name: created.name, sale: created._id}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
    }

    // Record commission
    await recordCommission({
        sourceId: created._id,
        sourceType: CommissionSourceType.SALE,
        companyId: company._id,
        session, actionUserCtx, logger, languageCode,
    });

    // Set approval status
    if (requiresApproval) {
        await saleService.updateByIdOrThrow(
            created._id,
            {$set: {approvalStatus: SaleApprovalStatus.PENDING_APPROVAL}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
    }

    // Notifications
    const paymentTypeStr: "cash" | "payment_plan" = paymentType === "payment_plan" ? "payment_plan" : "cash";
    if (requiresApproval) {
        emitNotificationEvent(NotificationEventCodes.SALE_PENDING_APPROVAL, {
            receiverIds: [soldBy],
            payload: {
                companyId: company._id.toString(),
                saleId: created._id.toString(),
                unitId: unit._id.toString(),
                unitNumber: unit.unitNumber,
                finalPrice: finalPrice.toString(),
                paymentType: paymentTypeStr,
                languageCode: languageCode ?? "en-US",
            },
        });
    } else {
        emitNotificationEvent(NotificationEventCodes.SALE_CREATED, {
            receiverIds: [buyer],
            payload: {
                companyId: company._id.toString(),
                saleId: created._id.toString(),
                unitId: unit._id.toString(),
                unitNumber: unit.unitNumber,
                finalPrice: finalPrice.toString(),
                paymentType: paymentTypeStr,
                currencySymbol: saleCurrencyDoc?.symbol,
                languageCode: languageCode ?? "en-US",
            },
        });
    }

    // Confirmation email (best-effort)
    const lang = languageCode ?? "en-US";
    const location = unitLocationForEmail(unit);
    const unitPriceSym = await unitPriceCurrencySymbolForEmail(unit, company._id);
    let unitPriceDisplay: string | undefined;
    if (unit.price != null) {
        const amt = formatMoneyAmountForEmail(unit.price.toString(), lang);
        unitPriceDisplay = unitPriceSym ? `${amt} ${unitPriceSym}` : amt;
    }
    const saleSymForEmail = saleCurrencyDoc?.symbol;
    const finalDisp = finalPriceDisplayForEmail(finalPrice, saleSymForEmail, lang);

    const emailPayload: Parameters<typeof dispatchSaleClientEmail>[0] = {
        clientUserId: buyer,
        kind: "sale_created",
        languageCode: lang,
        companyId: company._id.toString(),
        companyName: company.name ?? "",
        saleId: created._id.toString(),
        saleCode: created.name,
        paymentType: paymentTypeStr,
        unitNumber: unit.unitNumber != null ? String(unit.unitNumber) : undefined,
        unitDisplayName: unit.name,
        projectName: location.projectName,
        edificeName: location.edificeName,
        floorName: location.floorName,
        unitPriceDisplay,
        localDiscountDisplay: formatDiscountForEmail(created.localDiscount, unit.price, unitPriceSym, lang),
        finalPriceDisplay: finalDisp,
        purchaseContractMediaId: purchaseContractMediaIdFromFormValue(params.purchaseContract),
    };

    // Down payment, installment count and schedule table. The plan is not committed yet, so read in-session.
    try {
        Object.assign(emailPayload, await salePlanSummaryForEmail({
            paymentPlanId: planId,
            companyId: company._id,
            currencySymbol: saleSymForEmail,
            languageCode: lang,
            session,
        }));
    } catch { /* best-effort */ }

    // The buyer hears about the sale once it is saved (D06): sent after the commit, then stamped.
    await runAfterCommit(session, async () => {
        try {
            const emailed = await dispatchSaleClientEmail(emailPayload);
            if (emailed) {
                await saleService.updateByIdOrThrow(
                    created._id,
                    {$set: {saleConfirmationEmailSentAt: new Date()}},
                    {logger, languageCode, auditUserId: actionUserCtx.userId},
                );
            }
        } catch (err: unknown) {
            logger.debug(`Sale created client email skipped or failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });

    // Staff watchers (Sales & handover → Notify on sales)
    await runAfterCommit(session, async () => {
        void notifySalesWatchers({
            companyId: company._id,
            companyName: company.name ?? "",
            languageCode: lang,
            saleId: created._id.toString(),
            saleCode: created.name,
            pendingApproval: !!requiresApproval,
            finalPriceDisplay: finalDisp,
            unitPriceDisplay: emailPayload.unitPriceDisplay,
            localDiscountDisplay: emailPayload.localDiscountDisplay,
            downPaymentDisplay: emailPayload.downPaymentDisplay,
            downPaymentPaid: emailPayload.downPaymentPaid,
            numberOfInstallments: emailPayload.numberOfInstallments,
            paymentSchedule: emailPayload.paymentSchedule,
            paymentType: paymentTypeStr,
            buyerId: buyer ? String(buyer) : undefined,
            soldById: soldBy ? String(soldBy) : undefined,
            unitId: unit._id.toString(),
            unitNumber: emailPayload.unitNumber,
            unitDisplayName: unit.name,
            projectName: location.projectName,
            edificeName: location.edificeName,
            floorName: location.floorName,
        });
    });
}
