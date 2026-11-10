import {ObjectId, Decimal128} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {schemaSanitizer} from "@coreModule/utilities/middlewares/schemaSanitizerMW";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {saleService} from "../../../../database/schemas/sale/sale.service";
import {unitService} from "../../../../database/schemas/unit/unit.service";
import {paymentPlanService} from "../../../../database/schemas/paymentPlan/paymentPlan.service";
import {reservationService} from "../../../../database/schemas/reservation/reservation.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {userService} from "@coreModule/database/schemas/user/user.service";
import {commissionService} from "../../../../database/schemas/commission/commission.service";
import {propertyManagementConfigService} from "../../../../database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import Sale, {SaleApprovalStatus, SalePaymentType} from "../../../../database/schemas/sale/sale";
import PaymentPlan, {
    computePaymentPlanRemainingBalance,
    InstallmentStatus,
    PaymentPlanStatus,
} from "../../../../database/schemas/paymentPlan/paymentPlan";
import {ReservationStatus} from "../../../../database/schemas/reservation/reservation";
import {CommissionSourceType, CommissionStatus} from "../../../../database/schemas/commission/commission";
import {recordCommission} from "../../../../utilities/mappers/commissions/commission";
import {releaseSale, retakeSale} from "../../../../database/schemas/sale/sale.helper";
import type {IUnit} from "../../../../database/schemas/unit/unit";
import type {ICurrency} from "@coreModule/database/schemas/currency/currency";
import type {CrudOptions} from "@coreModule/database/services/baseCrudService";
import {
    allocatePaymentPlanContractInterest,
    parseIsoDatePrefix,
    parseMoneyInput,
    paymentPlanScheduleErrorKey,
    type PaymentPlanInstallmentScheduleInput,
} from "@propertyManagement/utilities/sale/paymentPlanContractInterest";
import {saleToDTO, salesToDTO} from "@propertyManagement/utilities/mappers/sale/saleMapper.dto";
import {paymentPlanToDTO} from "@propertyManagement/utilities/mappers/paymentPlan/paymentPlanMapper.dto";
import {salesToSelect} from "@propertyManagement/utilities/mappers/sale/saleMapper.select";
import {generatePaymentPlanPdf} from "@propertyManagement/utilities/pdf/paymentPlanPdf";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {
    dispatchSaleClientEmail,
} from "@propertyManagement/utilities/database/sale/saleClientEmailDispatch";
import {
    formatDiscountForEmail,
    formatMoneyAmountForEmail,
    UNIT_EMAIL_POPULATE,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import {createSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/createSale.form.validator";
import {editSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/editSale.form.validator";
import {saleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.form.validator";
import {SaleActions} from "../../../../database/schemas/sale/sale.actions";
import type {PaymentPlan as PaymentPlanData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/paymentPlan.dto";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {notifySalesWatchers} from "@propertyManagement/utilities/sale/salesStaffNotify";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {salePlanSummaryForEmail} from "@propertyManagement/utilities/emails/salePlanSummaryForEmail";
import authMW, {type AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import type {Request, Response} from "express";
import type {SingleForm} from "armonia/src/modules/core/types/shared.types";
import {salesWithHandoverContext} from "@propertyManagement/utilities/handoverPackage/handoverPackageChecklist";
import {addMoney, fromMinor, minorToNumber, toMinor} from "armonia/src/modules/core/helpers/money";
import {computeSalePricing} from "armonia/src/modules/propertyManagement/helpers/salePricing";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";

export const basePath = "/api/realEstate/unit/sale";

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function purchaseContractMediaIdFromFormValue(v: unknown): string | undefined {
    const s = Array.isArray(v) ? v[0] : v;
    const t = s != null ? String(s).trim() : "";
    return t !== "" ? t : undefined;
}

async function unitPriceCurrencySymbolForEmail(foundUnit: any, companyId: ObjectId): Promise<string | undefined> {
    try {
        const pc = foundUnit.priceCurrency;
        const pcid = pc instanceof ObjectId ? pc : pc?._id;
        const pcDoc = pcid ? await currencyService.findOne({_id: new ObjectId(pcid), company: companyId}) : undefined;
        return pcDoc?.symbol || undefined;
    } catch {
        return undefined;
    }
}

function finalPriceDisplayForEmail(finalPrice: number | Decimal128 | undefined, currencySymbol: string | undefined, languageCode: string): string | undefined {
    if (finalPrice == null) return undefined;
    const raw = typeof finalPrice === "object" && finalPrice !== null && "toString" in finalPrice ? finalPrice.toString() : String(finalPrice);
    const amt = formatMoneyAmountForEmail(raw, languageCode);
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

// ─────────────────────────────────────────────────────────────────────────────
// createCrudRouter
// ─────────────────────────────────────────────────────────────────────────────

async function saleExtraListFilter(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {unit, project, edifice, floor, company, logger, languageCode} = params as {
        unit?: string;
        project?: string;
        edifice?: string;
        floor?: string;
        company: {_id: ObjectId};
        logger: unknown;
        languageCode: string;
    };
    const opts = {logger, languageCode, withDeleted: false as const};
    const filter: Record<string, unknown> = {};

    if (unit && ObjectId.isValid(unit)) {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            opts as Parameters<typeof unitService.findOneOrThrow>[1],
        );
        filter.unit = foundUnit._id;
        return filter;
    }

    const unitScope: Record<string, unknown> = {company: company._id};
    if (project && ObjectId.isValid(project)) unitScope.project = new ObjectId(String(project));
    if (edifice && ObjectId.isValid(edifice)) unitScope.edifice = new ObjectId(String(edifice));
    if (floor && ObjectId.isValid(floor)) unitScope.floor = new ObjectId(String(floor));
    if (unitScope.project || unitScope.edifice || unitScope.floor) {
        const units = await unitService.find(
            unitScope,
            opts as Parameters<typeof unitService.find>[1],
            undefined,
            "_id",
        );
        filter.unit = {$in: units.map((u) => u._id)};
    }

    return filter;
}

const {router} = createCrudRouter({
    collectionName: "sales",
    model: Sale,
    service: saleService,
    listSchema: saleFormSchema,
    extraListFilter: saleExtraListFilter,
    createSchema: createSaleFormSchema,
    editSchema: editSaleFormSchema,
    toDTO: saleToDTO,
    toDTOArray: salesToDTO,
    toSelect: salesToSelect,
    defaultSort: {saleDate: -1},

    createMiddleware: [
        mediaUploadMW({
            fields: {
                purchaseContract: 1,
                additionalDocuments: 10,
            },
            maxFileSize: 100 * 1024 * 1024,
        }),
    ],

    actions: SaleActions,

    enrichList: async (docs, params) => salesWithHandoverContext(docs, params),
    enrichSingle: async (doc, params) => {
        const [enriched] = await salesWithHandoverContext([doc], params);
        return enriched;
    },
    enrichUpdate: async (doc, params) => {
        const [enriched] = await salesWithHandoverContext([doc], params);
        return enriched;
    },

    // ── Select: custom field sanitization + DSL filter ──────────────────────
    overrideSelectHandler: async (params) => {
        const {logger, languageCode, actionUserCtx, company, name, page, limit, dslFilterQuery} = params as any;

        logger.start("Fetching sales for select...");

        const sanitizedFields = SchemaGuard.sanitizeFields(
            Sale,
            {name: {}, unit: {keys: {name: {}, unitNumber: {}}}, saleDate: {}, paymentType: {}},
            "read", actionUserCtx, languageCode,
        );
        const populate = SchemaGuard.generatePopulate(sanitizedFields, Sale.schema);

        const filter: Record<string, unknown> = {company: company._id};
        if (dslFilterQuery && Object.keys(dslFilterQuery as object).length > 0) {
            filter.$and = [...((filter.$and as unknown[]) ?? []), dslFilterQuery];
        }
        if (name !== undefined && name !== "" && sanitizedFields.name) {
            filter.name = {$regex: escapeRegex(String(name).trim()), $options: "i"};
        }

        const [sales, total] = await Promise.all([
            saleService.find(filter, {logger, languageCode}, populate.populate, populate.select || "", {saleDate: -1}, limit, (page - 1) * limit),
            saleService.count(filter, {logger, languageCode}),
        ]);

        logger.finish("Finished fetching sales for select!");
        return {data: salesToSelect(sales), total};
    },

    // ── Create: unified cash + payment-plan handler ─────────────────────────
    buildCreateData: async (params) => {
        const {
            session, logger, languageCode, company, actionUserCtx,
            paymentType, unit, soldBy, buyer, saleDate, saleCurrency,
            localDiscount, purchaseContract, additionalDocuments, notes,
            transactionReference, reservationExchangeRate, saleExchangeRate, buyerCompany,
            // payment plan fields (all optional at schema level)
            downPayment, installments: installmentsParam, numberOfInstallments: numberOfInstallmentsField,
            startDate: startDateField, endDate: endDateField,
            interestRate, gracePeriodDays, lateFeePercentage, paymentPlanNotes,
            downPaymentPaid, downPaymentDate,
        } = params as any;

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
        const finalPrice = minorToNumber(pricing.finalPriceMinor, saleDecimals);

        // stash on params so afterCreate can reuse without re-fetching
        (params as any).__foundUnitSnapshot = {
            _id: foundUnit._id,
            price: foundUnit.price,
            priceCurrency: foundUnit.priceCurrency,
            reservation: foundUnit.reservation,
            unitNumber: foundUnit.unitNumber,
            name: foundUnit.name,
            status: foundUnit.status,
            ...unitLocationForEmail(foundUnit),
        };
        (params as any).__computedFinalPrice = finalPrice;
        (params as any).__saleCurrencyDoc = saleCurrencyDoc;

        let paymentPlanId: ObjectId | undefined;

        if (paymentType === "payment_plan") {
            let installmentsArray: any[] = [];
            if (typeof installmentsParam === "string") {
                try { installmentsArray = JSON.parse(installmentsParam); }
                catch { throw apiValidationException("invalid_installments_format", "", null, languageCode); }
            } else if (Array.isArray(installmentsParam)) {
                installmentsArray = installmentsParam;
            } else {
                throw apiValidationException("installments_required", "", null, languageCode);
            }
            if (!installmentsArray?.length) throw apiValidationException("at_least_one_installment_required", "", null, languageCode);

            const downPaymentMinor = toMinor(downPayment, saleDecimals);
            if (downPaymentMinor > pricing.finalPriceMinor) throw apiValidationException("down_payment_exceeds_final_price", "", null, languageCode);

            const nFromForm = parseInt(String(numberOfInstallmentsField ?? ""), 10);
            if (!Number.isFinite(nFromForm) || nFromForm !== installmentsArray.length) {
                throw apiValidationException("payment_plan_installment_count_mismatch", "", null, languageCode);
            }
            if (parseIsoDatePrefix(startDateField) !== parseIsoDatePrefix(saleDate)) {
                throw apiValidationException("payment_plan_start_date_must_match_sale_date", "", null, languageCode);
            }

            const scheduleInputs: PaymentPlanInstallmentScheduleInput[] = installmentsArray.map((inst: any, idx: number) => ({
                installmentNumber: typeof inst?.installmentNumber === "number" && Number.isFinite(inst.installmentNumber) ? Math.floor(inst.installmentNumber) : idx + 1,
                dueDate:           parseIsoDatePrefix(inst?.dueDate),
                amount:            parseMoneyInput(inst?.amount),
                notes:             typeof inst?.notes === "string" ? inst.notes : undefined,
            }));

            const allocation = allocatePaymentPlanContractInterest({
                financedPrincipal: minorToNumber(pricing.finalPriceMinor - downPaymentMinor, saleDecimals),
                annualRatePercent: interestRate,
                planStartDate:     parseIsoDatePrefix(startDateField),
                planEndDate:       parseIsoDatePrefix(endDateField),
                rows:              scheduleInputs,
            });
            if (!allocation.ok) throw apiValidationException(paymentPlanScheduleErrorKey(allocation.code), "", null, languageCode);

            const installments: any[] = allocation.installments.map((row) => ({
                installmentNumber: row.installmentNumber,
                dueDate:           new Date(`${row.dueDate}T00:00:00.000Z`),
                amount:            Decimal128.fromString(row.amount.toString()),
                principalAmount:   Decimal128.fromString(row.principalAmount.toString()),
                interestAmount:    Decimal128.fromString(row.interestAmount.toString()),
                status:            InstallmentStatus.PENDING,
                notes:             row.notes || "",
            }));

            const totalInstallmentAmount = addMoney(...allocation.installments.map((r) => r.amount));

            const planDateFromForm = (v: unknown): Date | null => {
                const p = parseIsoDatePrefix(v);
                if (!p) return null;
                const d = new Date(`${p}T00:00:00.000Z`);
                return Number.isNaN(d.getTime()) ? null : d;
            };
            const startDate = planDateFromForm(startDateField) ?? installments[0]?.dueDate ?? new Date();
            const endDate   = planDateFromForm(endDateField)   ?? installments[installments.length - 1]?.dueDate ?? new Date();

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
                    downPaymentDate:      downPaymentDate ? new Date(downPaymentDate) : undefined,
                    remainingBalance:     Decimal128.fromString(remainingBalance.toString()),
                    numberOfInstallments: installmentsArray.length,
                    installmentAmount:    Decimal128.fromString(totalInstallmentAmount.toString()),
                    interestRate,
                    startDate,
                    endDate,
                    installments,
                    gracePeriodDays,
                    lateFeePercentage,
                    notes:                paymentPlanNotes || "",
                    company,
                } as any,
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
            paymentPlanId = paymentPlan._id;
        }

        const firstMediaId = (value: unknown) => {
            const raw = Array.isArray(value) ? value[0] : value;
            if (raw == null || raw === "") return undefined;
            return new ObjectId(raw.toString());
        };

        return {
            unit:                       foundUnit._id,
            paymentType:                paymentType === "payment_plan" ? SalePaymentType.PAYMENT_PLAN : SalePaymentType.CASH,
            buyer:                      buyerDoc,
            buyerCompany:               buyerCompany ? new ObjectId(buyerCompany) : undefined,
            soldBy:                     soldByDoc,
            saleCurrency:               saleCurrencyDoc,
            saleDate:                   new Date(saleDate),
            listedUnitPrice:            foundUnit.price,
            listedUnitCurrency:         foundUnit.priceCurrency,
            saleExchangeRate:           pricing.saleExchangeRate,
            localDiscount:              Decimal128.fromString(String(localDiscount ?? 0)),
            finalPrice:                 decimal128FromMinor(pricing.finalPriceMinor, saleDecimals),
            notes,
            purchaseContract:           firstMediaId(purchaseContract),
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
    },

    afterCreate: async (created, params) => {
        const {session, logger, languageCode, company, actionUserCtx, paymentType, buyer, soldBy} = params as any;
        const unitSnapshot: any = (params as any).__foundUnitSnapshot;
        const finalPrice: number = (params as any).__computedFinalPrice ?? 0;
        const saleCurrencyDoc: any = (params as any).__saleCurrencyDoc;

        const {requiresSaleApproval: requiresApproval} = await propertyManagementConfigService.getSettingsForCompany(
            company._id,
            {session, logger, languageCode},
        );

        // Mark unit as sold
        await unitService.updateByIdOrThrow(
            unitSnapshot._id,
            {$set: {status: UnitStatus.SOLD, sale: created._id}, $unset: {unavailableNotes: ""}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        // Convert reservation if present
        if (unitSnapshot.reservation) {
            const reservationId = (unitSnapshot.reservation as any)?._id ?? unitSnapshot.reservation;
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
        if (paymentType === "payment_plan" && created.paymentPlan) {
            const planId = (created.paymentPlan as any)?._id ?? created.paymentPlan;
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
                    unitId: unitSnapshot._id.toString(),
                    unitNumber: unitSnapshot.unitNumber,
                    finalPrice: finalPrice?.toString(),
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
                    unitId: unitSnapshot._id.toString(),
                    unitNumber: unitSnapshot.unitNumber,
                    finalPrice: finalPrice?.toString(),
                    paymentType: paymentTypeStr,
                    currencySymbol: saleCurrencyDoc?.symbol,
                    languageCode: languageCode ?? "en-US",
                },
            });
        }

        // Confirmation email (best-effort)
        const lang = languageCode ?? "en-US";
        const unitPriceSym = await unitPriceCurrencySymbolForEmail(unitSnapshot, company._id);
        let unitPriceDisplay: string | undefined;
        if (unitSnapshot.price != null) {
            const amt = formatMoneyAmountForEmail(unitSnapshot.price.toString(), lang);
            unitPriceDisplay = unitPriceSym ? `${amt} ${unitPriceSym}` : amt;
        }
        const saleSymForEmail = saleCurrencyDoc?.symbol as string | undefined;
        const finalDisp = finalPriceDisplayForEmail(finalPrice, saleSymForEmail, lang);
        const purchaseContractMediaId = purchaseContractMediaIdFromFormValue((params as any).purchaseContract);

        let emailPayload: any = {
            clientUserId: buyer,
            kind: "sale_created",
            languageCode: lang,
            companyId: company._id.toString(),
            companyName: company.name ?? "",
            saleId: created._id.toString(),
            saleCode: created.name,
            paymentType: paymentTypeStr,
            unitNumber: unitSnapshot.unitNumber != null ? String(unitSnapshot.unitNumber) : undefined,
            unitDisplayName: unitSnapshot.name,
            projectName: unitSnapshot.projectName,
            edificeName: unitSnapshot.edificeName,
            floorName: unitSnapshot.floorName,
            unitPriceDisplay,
            localDiscountDisplay: formatDiscountForEmail(created.localDiscount, unitSnapshot.price, unitPriceSym, lang),
            finalPriceDisplay: finalDisp,
            purchaseContractMediaId,
        };

        // Down payment, installment count and schedule table. The plan is not committed yet, so read in-session.
        const planId = paymentType === "payment_plan" && created.paymentPlan
            ? (created.paymentPlan as any)?._id ?? created.paymentPlan
            : undefined;
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
                unitId: unitSnapshot._id.toString(),
                unitNumber: emailPayload.unitNumber,
                unitDisplayName: unitSnapshot.name,
                projectName: unitSnapshot.projectName,
                edificeName: unitSnapshot.edificeName,
                floorName: unitSnapshot.floorName,
            });
        });
    },

    // ── Update ─────────────────────────────────────────────────────────────
    buildUpdateData: async (params, writeFields) => {
        const {notes, transactionReference} = params as {notes?: string | null; transactionReference?: string | null};

        const update: Record<string, unknown> = {};

        if (notes !== undefined && writeFields.notes) update.notes = notes;
        if (transactionReference !== undefined && writeFields.transactionReference) {
            update.transactionReference = transactionReference == null || String(transactionReference).trim() === "" ? undefined : String(transactionReference).trim();
        }

        return update;
    },

    // ── Delete ─────────────────────────────────────────────────────────────
    beforeDelete: async (params, doc) => {
        const {languageCode, company} = params as any;
        const commission = await commissionService.findOne({
            company: company._id,
            sourceType: CommissionSourceType.SALE,
            sourceId: (doc as any)._id,
        });
        if (commission && commission.status === CommissionStatus.PAID) {
            throw apiValidationException("sale_cannot_be_deleted_as_it_has_a_paid_commission", "", null, languageCode);
        }
    },

    afterDelete: async (params, doc) => {
        const {session, logger, languageCode, company, actionUserCtx} = params;
        const ctx = {session, logger, languageCode, actionUserCtx, companyId: company._id};
        await releaseSale(doc, ctx);
        // The plan belongs to the sale (and its required reference would block the delete); restoring brings it back.
        const planId = nestedEntityToRef(doc.paymentPlan);
        if (planId) await paymentPlanService.deleteById(planId, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    },

    // ── Restore ────────────────────────────────────────────────────────────
    overrideRestoreHandler: async (params) => {
        const {logger, languageCode, session, _id, company, actionUserCtx} = params as any;

        logger.start(`Restoring sale: ${_id}...`);
        SchemaGuard.checkModelPermission(Sale, "restore", actionUserCtx, languageCode);

        const foundSale = await saleService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode, withDeleted: true});
        await saleService.restoreOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        await retakeSale(foundSale, {session, logger, languageCode, actionUserCtx, companyId: company._id});

        logger.finish(`Successfully restored sale: ${_id}`);
        return {message: "Sale successfully restored"};
    },
});

// ── POST /paymentPlan/single ──────────────────────────────────────────────────

router.post(
    "/paymentPlan/single",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(validateSingleForm),
    schemaSanitizer({model: "paymentplans", requiredModes: ["read"]}),
    asyncHandler(async (params: any): Promise<PaymentPlanData> => {
        const {logger, languageCode, _id, company, sanitizedReadFields} = params;

        logger.start(`Fetching payment plan by id: ${_id}...`);
        const populate = SchemaGuard.generatePopulate(sanitizedReadFields, PaymentPlan.schema);
        const plan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
            populate.populate,
            populate.select || "",
        );
        logger.finish(`Finished fetching payment plan by id: ${_id}`);
        return paymentPlanToDTO(plan);
    }),
);

// ── POST /paymentPlan/pdf ─────────────────────────────────────────────────────

router.post(
    "/paymentPlan/pdf",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(validateSingleForm),
    schemaSanitizer({model: "paymentplans", requiredModes: ["read"]}),
    asyncHandler(async (params: AuthenticatedMWType & SingleForm, _query: unknown, _req: Request, res: Response) => {
        const {logger, languageCode, _id, company} = params;

        const plan = await paymentPlanService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {logger, languageCode});
        const planDto = paymentPlanToDTO(plan);
        const pdfBytes = await generatePaymentPlanPdf(planDto, company.name);

        const filename = `payment-schedule-${planDto.name ?? _id}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader("Content-Length", pdfBytes.length);
        res.send(Buffer.from(pdfBytes));
    }),
);

export {router};
