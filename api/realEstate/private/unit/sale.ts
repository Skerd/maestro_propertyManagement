import {ObjectId, Decimal128} from "mongodb";
import Decimal from "decimal.js";
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
import {handoverPackageService} from "../../../../database/schemas/handoverPackage/handoverPackage.service";
import {propertyManagementConfigService} from "../../../../database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {recordCommission} from "../../../../utilities/mappers/commissions/commission";
import Sale, {SaleApprovalStatus, SalePaymentType} from "../../../../database/schemas/sale/sale";
import PaymentPlan, {
    computePaymentPlanRemainingBalance,
    InstallmentStatus,
    PaymentPlanStatus,
} from "../../../../database/schemas/paymentPlan/paymentPlan";
import {ReservationStatus} from "../../../../database/schemas/reservation/reservation";
import {CommissionSourceType, CommissionStatus} from "../../../../database/schemas/commission/commission";
import {
    allocatePaymentPlanContractInterest,
    parseIsoDatePrefix,
    parseMoneyInput,
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
import authMW from "@coreModule/utilities/middlewares/authMW";

export const basePath = "/api/realEstate/unit/sale";

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function purchaseContractMediaIdFromFormValue(v: unknown): string | undefined {
    const s = Array.isArray(v) ? v[0] : v;
    const t = s != null ? String(s).trim() : "";
    return t !== "" ? t : undefined;
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

function finalPriceDisplayForEmail(finalPrice: number | Decimal128 | undefined, currencySymbol: string | undefined, languageCode: string): string | undefined {
    if (finalPrice == null) return undefined;
    const raw = typeof finalPrice === "object" && finalPrice !== null && "toString" in finalPrice ? finalPrice.toString() : String(finalPrice);
    const amt = formatMoneyAmountForEmail(raw, languageCode);
    return currencySymbol ? `${amt} ${currencySymbol}` : amt;
}

function computeSalePricing(foundUnit: any, localDiscount: any, saleExchangeRate: any, saleCurrency: string, reservationExchangeRate: any, languageCode: string) {
    let reservationConvertedAmount: number | undefined;
    let finalPriceExchangeRate = 1;

    if (saleCurrency !== foundUnit.priceCurrency?._id?.toString()) {
        if (!saleExchangeRate) throw apiValidationException("sale_exchange_rate_required", "", null, languageCode);
        finalPriceExchangeRate = parseFloat((saleExchangeRate ?? "1") + "");
    }
    if (foundUnit.reservation && foundUnit.reservation?.depositCurrency?._id.toString() !== saleCurrency) {
        if (!reservationExchangeRate) throw apiValidationException("reservation_exchange_rate_required", "", null, languageCode);
        reservationConvertedAmount = reservationExchangeRate * parseFloat(foundUnit.reservation?.depositAmount?.toString() || "1");
    }

    const priceD = new Decimal(foundUnit.price.toString());
    const discountD = new Decimal(String(localDiscount ?? 0));
    const discountedPrice = priceD.minus(priceD.mul(discountD).div(100));
    const finalPrice = new Decimal(String(finalPriceExchangeRate))
        .mul(discountedPrice.minus(new Decimal(String(reservationConvertedAmount ?? 0))))
        .toNumber();

    if (finalPrice < 0) throw apiValidationException("final_price_cannot_be_negative", "", null, languageCode);
    return {finalPrice, reservationConvertedAmount, finalPriceExchangeRate};
}

function decimalFieldToNumber(value: unknown): number | undefined {
    if (value == null) return undefined;
    const raw = typeof value === "object" && value !== null && "toString" in value ? value.toString() : String(value);
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : undefined;
}

/** Recompute `finalPrice` from frozen sale snapshots when `localDiscount` changes on edit. */
function computeSaleFinalPriceFromSnapshot(existing: {
    listedUnitPrice?: unknown;
    saleExchangeRate?: unknown;
    reservationConvertedAmount?: unknown;
}, localDiscount: unknown, languageCode: string): number {
    const listed = decimalFieldToNumber(existing.listedUnitPrice);
    if (listed == null) throw apiValidationException("final_price_cannot_be_negative", "", null, languageCode);
    const priceD = new Decimal(String(listed));
    const discountD = new Decimal(String(localDiscount ?? 0));
    const discountedPrice = priceD.minus(priceD.mul(discountD).div(100));
    const rate = decimalFieldToNumber(existing.saleExchangeRate) ?? 1;
    const reservationConverted = decimalFieldToNumber(existing.reservationConvertedAmount) ?? 0;
    const finalPrice = new Decimal(String(rate))
        .mul(discountedPrice.minus(new Decimal(String(reservationConverted))))
        .toNumber();
    if (finalPrice < 0) throw apiValidationException("final_price_cannot_be_negative", "", null, languageCode);
    return finalPrice;
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
                handoverCertificate: 1,
                titleTransferCertificate: 1,
            },
            maxFileSize: 100 * 1024 * 1024,
        }),
    ],
    editMiddleware: [
        mediaUploadMW({fields: {handoverCertificate: 1, titleTransferCertificate: 1}, maxFileSize: 100 * 1024 * 1024}),
    ],

    actions: SaleActions,

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
            handoverDate, handedOverBy, handoverNotes, handoverCertificate,
            titleTransferDate, deedNumber, notaryName, titleTransferCertificate,
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

        const {finalPrice, reservationConvertedAmount} = computeSalePricing(
            foundUnit, localDiscount, saleExchangeRate, saleCurrency, reservationExchangeRate, languageCode,
        );

        const [buyerDoc, soldByDoc, saleCurrencyDoc] = await Promise.all([
            userService.findOneOrThrow({_id: new ObjectId(buyer), "roles.company": company._id}, {session, logger, languageCode}),
            userService.findOneOrThrow({_id: new ObjectId(soldBy), "roles.company": company._id}, {session, logger, languageCode}),
            currencyService.findOneOrThrow({_id: new ObjectId(saleCurrency), company: company._id}, {session, logger, languageCode}),
        ]);

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

            if (downPayment > finalPrice + 0.005) throw apiValidationException("down_payment_exceeds_final_price", "", null, languageCode);

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
                financedPrincipal: finalPrice - downPayment,
                annualRatePercent: interestRate,
                planStartDate:     parseIsoDatePrefix(startDateField),
                planEndDate:       parseIsoDatePrefix(endDateField),
                rows:              scheduleInputs,
            });
            if (!allocation.ok) {
                throw apiValidationException(
                    allocation.code === "installment_too_small" ? "payment_plan_installment_too_small" : "payment_plan_schedule_invalid",
                    "", null, languageCode,
                );
            }

            const installments: any[] = allocation.installments.map((row) => ({
                installmentNumber: row.installmentNumber,
                dueDate:           new Date(`${row.dueDate}T00:00:00.000Z`),
                amount:            Decimal128.fromString(row.amount.toString()),
                principalAmount:   Decimal128.fromString(row.principalAmount.toString()),
                interestAmount:    Decimal128.fromString(row.interestAmount.toString()),
                status:            InstallmentStatus.PENDING,
                notes:             row.notes || "",
            }));

            const totalInstallmentAmount = allocation.installments.reduce((sum, r) => sum + r.amount, 0);

            const planDateFromForm = (v: unknown): Date | null => {
                const p = parseIsoDatePrefix(v);
                if (!p) return null;
                const d = new Date(`${p}T00:00:00.000Z`);
                return Number.isNaN(d.getTime()) ? null : d;
            };
            const startDate = planDateFromForm(startDateField) ?? installments[0]?.dueDate ?? new Date();
            const endDate   = planDateFromForm(endDateField)   ?? installments[installments.length - 1]?.dueDate ?? new Date();

            const remainingBalance = computePaymentPlanRemainingBalance({
                totalAmount:     finalPrice,
                downPayment,
                downPaymentPaid: !!downPaymentPaid,
                installments,
            });

            const paymentPlan = await paymentPlanService.create(
                {
                    sale:                 new ObjectId(),
                    status:               PaymentPlanStatus.ACTIVE,
                    totalAmount:          Decimal128.fromString(finalPrice.toString()),
                    downPayment:          Decimal128.fromString(downPayment.toString()),
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

        const settingHandoverDate = typeof handoverDate === "string" && handoverDate.trim() !== "";

        const handedOverById = typeof handedOverBy === "string" && handedOverBy.trim() !== "" ? handedOverBy : undefined;
        if (handedOverById) {
            await userService.findOneOrThrow(
                {_id: new ObjectId(handedOverById), "roles.company": company._id},
                {session, logger, languageCode},
            );
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
            saleExchangeRate:           saleCurrency !== foundUnit.priceCurrency?._id?.toString() ? saleExchangeRate : undefined,
            localDiscount:              Decimal128.fromString(String(localDiscount ?? 0)),
            finalPrice,
            notes,
            purchaseContract:           Array.isArray(purchaseContract) ? purchaseContract[0] : purchaseContract,
            additionalDocuments:        Array.isArray(additionalDocuments) ? additionalDocuments : (additionalDocuments ? [additionalDocuments] : []),
            transactionReference,
            reservation:                foundUnit.reservation,
            reservationDepositAmount:   foundUnit.reservation?.depositAmount,
            reservationDepositCurrency: foundUnit.reservation?.depositCurrency,
            reservationExchangeRate,
            reservationConvertedAmount,
            company:                    company._id,
            paymentPlan:                paymentPlanId,
            handoverDate:               settingHandoverDate ? new Date(handoverDate) : undefined,
            handedOverBy:               handedOverById ? new ObjectId(handedOverById) : undefined,
            handoverNotes:              typeof handoverNotes === "string" && handoverNotes.trim() !== "" ? handoverNotes : undefined,
            handoverCertificate:        firstMediaId(handoverCertificate),
            titleTransferDate:          typeof titleTransferDate === "string" && titleTransferDate.trim() !== "" ? new Date(titleTransferDate) : undefined,
            deedNumber:                 typeof deedNumber === "string" && deedNumber.trim() !== "" ? deedNumber.trim() : undefined,
            notaryName:                 typeof notaryName === "string" && notaryName.trim() !== "" ? notaryName.trim() : undefined,
            titleTransferCertificate:   firstMediaId(titleTransferCertificate),
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
            {$set: {status: UnitStatus.SOLD, sale: created._id}},
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
        let unitPriceDisplay: string | undefined;
        try { unitPriceDisplay = await unitPriceDisplayForEmail(unitSnapshot, company._id, lang); } catch { /* best-effort */ }
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
            finalPriceDisplay: finalDisp,
            purchaseContractMediaId,
        };

        if (paymentType === "payment_plan" && created.paymentPlan) {
            const planId = (created.paymentPlan as any)?._id ?? created.paymentPlan;
            try {
                const ppForEmail = await paymentPlanService.findOneOrThrow(
                    {_id: planId, company: company._id},
                    {logger, languageCode},
                    "downPayment numberOfInstallments",
                );
                if (ppForEmail.downPayment != null) {
                    const dAmt = formatMoneyAmountForEmail(ppForEmail.downPayment.toString(), lang);
                    emailPayload.downPaymentDisplay = saleSymForEmail ? `${dAmt} ${saleSymForEmail}` : dAmt;
                }
                emailPayload.numberOfInstallments = ppForEmail.numberOfInstallments;
            } catch { /* best-effort */ }
        }

        try {
            const emailed = await dispatchSaleClientEmail(emailPayload, {session});
            if (emailed) {
                await saleService.updateByIdOrThrow(
                    created._id,
                    {$set: {saleConfirmationEmailSentAt: new Date()}},
                    {session, logger, languageCode, auditUserId: actionUserCtx.userId},
                );
            }
        } catch (err: unknown) {
            logger.debug(`Sale created client email skipped or failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    },

    // ── Update ─────────────────────────────────────────────────────────────
    buildUpdateData: async (params, writeFields) => {
        const {
            notes, transactionReference, localDiscount,
            handoverDate, handedOverBy, handoverNotes, handoverCertificate: handoverCertificateFile,
            titleTransferDate, deedNumber, notaryName, titleTransferCertificate: titleTransferCertificateFile,
            existing, company, session, logger, languageCode,
        } = params as any;

        // Handover gate: when the company requires it, a handover date can only be
        // stamped once the unit's HandoverPackage is completed (delivery evidence).
        const settingHandoverDate = handoverDate !== undefined && handoverDate !== null;
        const alreadyHandedOver = !!existing?.handoverDate;
        let requiresHandoverPackage = false;
        if (settingHandoverDate && !alreadyHandedOver) {
            const settings = await propertyManagementConfigService.getSettingsForCompany(
                company._id,
                {session, logger, languageCode},
            );
            requiresHandoverPackage = settings.requiresHandoverPackageForHandover;
        }
        if (requiresHandoverPackage && settingHandoverDate && !alreadyHandedOver) {
            const unitId = existing?.unit?._id ?? existing?.unit;
            const completedPackage = unitId
                ? await handoverPackageService.findOne(
                    {unit: new ObjectId(unitId.toString()), company: company._id, status: "completed", deletedAt: null},
                    {session, logger, languageCode},
                )
                : null;
            if (!completedPackage) {
                throw apiValidationException("sale_handover_requires_completed_handover_package", "", null, languageCode);
            }
        }

        const update: Record<string, unknown> = {};

        if (notes !== undefined && writeFields.notes) update.notes = notes;
        if (transactionReference !== undefined && writeFields.transactionReference) {
            update.transactionReference = transactionReference == null || String(transactionReference).trim() === "" ? undefined : String(transactionReference).trim();
        }
        const canEditDiscount =
            existing?.paymentType !== SalePaymentType.PAYMENT_PLAN && !existing?.paymentPlan;
        if (localDiscount !== undefined && writeFields.localDiscount && canEditDiscount) {
            const listed = decimalFieldToNumber(existing?.listedUnitPrice);
            if (listed != null) {
                const finalPrice = computeSaleFinalPriceFromSnapshot(existing, localDiscount, languageCode);
                update.localDiscount = Decimal128.fromString(String(localDiscount ?? 0));
                update.finalPrice = Decimal128.fromString(String(finalPrice));
            }
        }
        if (handoverDate !== undefined) {
            update.handoverDate = handoverDate === null ? null : new Date(handoverDate);
        }
        if (handedOverBy !== undefined) {
            update.handedOverBy = handedOverBy === null ? null : new ObjectId(handedOverBy);
        }
        if (handoverNotes !== undefined) {
            update.handoverNotes = handoverNotes === null ? undefined : handoverNotes;
        }
        const hcFile = Array.isArray(handoverCertificateFile) ? handoverCertificateFile[0] : handoverCertificateFile;
        if (hcFile) update.handoverCertificate = new ObjectId(hcFile.toString());

        if (titleTransferDate !== undefined) {
            update.titleTransferDate = titleTransferDate === null ? null : new Date(titleTransferDate);
        }
        if (deedNumber !== undefined) update.deedNumber = deedNumber === null ? undefined : String(deedNumber).trim() || undefined;
        if (notaryName !== undefined)  update.notaryName  = notaryName  === null ? undefined : String(notaryName).trim()  || undefined;
        const ttcFile = Array.isArray(titleTransferCertificateFile) ? titleTransferCertificateFile[0] : titleTransferCertificateFile;
        if (ttcFile) update.titleTransferCertificate = new ObjectId(ttcFile.toString());

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
        const {session, logger, languageCode, _id, company, actionUserCtx} = params as any;

        const commission = await commissionService.findOne({
            company: company._id,
            sourceType: CommissionSourceType.SALE,
            sourceId: (doc as any)._id,
        });
        if (commission) {
            await commissionService.deleteById(commission._id, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        }

        const unit = await unitService.findOneOrThrow({_id: (doc as any).unit, company: company._id}, {session, logger, languageCode});
        const unitSaleId = (unit as any).sale?._id?.toString() ?? (unit as any).sale?.toString();
        if (unitSaleId === _id) {
            unit.status = unit.reservation ? UnitStatus.RESERVED : UnitStatus.AVAILABLE;
            (unit as any).sale = undefined;
            unit.$locals = unit.$locals || {};
            unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
            await unit.save({session});
        }
    },

    // ── Restore ────────────────────────────────────────────────────────────
    overrideRestoreHandler: async (params) => {
        const {logger, languageCode, session, _id, company, actionUserCtx} = params as any;

        logger.start(`Restoring sale: ${_id}...`);
        SchemaGuard.checkModelPermission(Sale, "restore", actionUserCtx, languageCode);

        const foundSale = await saleService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        const unit = await unitService.findOneOrThrow({_id: foundSale.unit, company: company._id}, {session, logger, languageCode});

        if (([UnitStatus.SOLD] as UnitStatus[]).includes(unit.status) || (unit as any).sale) {
            throw apiValidationException("sale_not_available_for_restore", "", null, languageCode);
        }

        await saleService.restoreOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});

        unit.status = UnitStatus.SOLD;
        (unit as any).sale = foundSale;
        unit.$locals = unit.$locals || {};
        unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await unit.save({session});

        const commission = await commissionService.findOne({company: company._id, sourceType: CommissionSourceType.SALE, sourceId: foundSale._id});
        if (commission) {
            await commissionService.restoreOneOrThrow({_id: commission._id, company: company._id}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        } else {
            await recordCommission({sourceId: foundSale._id, sourceType: CommissionSourceType.SALE, companyId: company._id, session, actionUserCtx, logger, languageCode});
        }

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
    asyncHandler(async (req: any, res: any) => {
        const {company, languageCode} = req;
        const {_id} = req.body ?? {};
        if (!_id || !ObjectId.isValid(String(_id))) {
            throw apiValidationException("paymentPlan_not_found", "", null, languageCode);
        }

        const plan = await paymentPlanService.findOneOrThrow(
            {_id: new ObjectId(String(_id)), company: company._id},
            {logger: req.logger ?? console, languageCode},
        );

        const planDto = paymentPlanToDTO(plan);
        const pdfBytes = await generatePaymentPlanPdf(planDto, (company as any)?.name);

        const filename = `payment-schedule-${planDto.name ?? _id}.pdf`;
        res.set("Content-Type", "application/pdf");
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        res.set("Content-Length", String(pdfBytes.length));
        res.send(Buffer.from(pdfBytes));
    }),
);

export {router};
