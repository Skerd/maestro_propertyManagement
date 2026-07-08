import {Decimal128, ObjectId} from "mongodb";
import {z} from "zod";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {ReservationSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.schema-def";
import {reservationService} from "../../../../database/schemas/reservation/reservation.service";
import {unitService} from "../../../../database/schemas/unit/unit.service";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {escapeRegex} from "@coreModule/utilities/helpers";
import Reservation, {type IReservation} from "../../../../database/schemas/reservation/reservation";
import {ReservationActions} from "../../../../database/schemas/reservation/reservation.actions";
import {
    createReservationFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/createReservation.form.validator";
import {
    reservationFormSchema
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.form.validator";
import {
    SelectResponse,
} from "armonia/src/modules/core/types/shared.types";
import {
    reservationsToDTO,
    reservationToDTO
} from "@propertyManagement/utilities/mappers/reservation/reservationMapper.dto";
import {reservationsToSelect} from "@propertyManagement/utilities/mappers/reservation/reservationMapper.select";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {emitNotificationEvent, NotificationEventCodes} from "@coreModule/domain/notifications/notificationEventBus";
import {
    dispatchReservationClientEmail,
    formatReservationExpirationForEmail,
} from "@propertyManagement/utilities/database/reservation/reservationClientEmailDispatch";
import {
    formatMoneyAmountForEmail,
    formatReservationDepositForEmailDisplay,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import {CommissionSourceType, CommissionStatus} from "../../../../database/schemas/commission/commission";
import {commissionService} from "../../../../database/schemas/commission/commission.service";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

const mediaUpload = mediaUploadMW({
    fields: {reservationContract: 10, additionalDocuments: 10},
    maxFileSize: 100 * 1024 * 1024,
});

async function reservationExtraListFilter(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {edificeId, company, logger, languageCode} = params as {
        edificeId?: string;
        company: {_id: ObjectId};
        logger: unknown;
        languageCode: string;
    };
    if (!edificeId || !ObjectId.isValid(edificeId)) return {};
    const units = await unitService.find(
        {company: company._id, edifice: new ObjectId(edificeId)},
        {logger, languageCode} as Parameters<typeof unitService.find>[1],
        null,
        "_id",
        {},
        undefined,
        undefined,
    );
    const unitIds = units.map((u) => u._id).filter((id): id is ObjectId => id != null);
    return {unit: {$in: unitIds}};
}

export const basePath = "/api/realEstate/unit/reservation";

// Reservations are immutable after create — lifecycle changes go through ReservationActions.
// editSchema/buildUpdateData are stubs required by createCrudRouter; PATCH is a no-op.
export const {router} = createCrudRouter({
    collectionName: "reservations",
    model: Reservation,
    service: reservationService,
    listSchema: reservationFormSchema,
    extraListFilter: reservationExtraListFilter,
    createSchema: createReservationFormSchema,
    editSchema: () => z.object({_id: z.string()}).passthrough() as any,
    toDTO: (r) => reservationToDTO(r),
    toDTOArray: (rs) => reservationsToDTO(rs),
    toSelect: reservationsToSelect,
    defaultSort: {reservationDate: -1},
    createMiddleware: [mediaUpload],
    actions: ReservationActions,
    buildUpdateData: () => ({}),
    overrideSelectHandler: async ({logger, languageCode, actionUserCtx, company, name, page, limit, dslFilterQuery}): Promise<SelectResponse> => {
        logger.start(`Fetching reservations for select...`);

        const sanitizedFields = SchemaGuard.sanitizeFields(
            Reservation,
            {name: {}, unit: {keys: {name: {}, unitNumber: {}}}, client: {keys: {name: {}, surname: {}}}, reservationDate: {}},
            "read",
            actionUserCtx,
            languageCode,
        );
        const populate = SchemaGuard.generatePopulate(sanitizedFields, Reservation.schema);

        const companyUnits = await unitService.find(
            {company: company._id},
            {logger, languageCode},
            null, "_id", {}, undefined, undefined,
        );
        const companyUnitIds = companyUnits.map((u) => u._id).filter((id): id is ObjectId => id != null);

        const filter: Record<string, unknown> = {company: company._id, unit: {$in: companyUnitIds}};

        if (dslFilterQuery && Object.keys(dslFilterQuery as object).length > 0) {
            filter.$and = [...((filter.$and as unknown[]) ?? []), dslFilterQuery];
        }

        if (name !== undefined && name !== "" && sanitizedFields.name) {
            filter["name"] = {$regex: escapeRegex(String(name).trim()), $options: "i"};
        }

        const [reservations, total] = await Promise.all([
            reservationService.find(
                filter,
                {logger, languageCode},
                populate.populate,
                populate.select || "",
                {reservationDate: -1},
                limit,
                (page - 1) * limit,
            ),
            reservationService.count(filter, {logger, languageCode}),
        ]);

        logger.finish(`Finished fetching reservations for select!`);
        return {data: reservationsToSelect(reservations), total};
    },
    buildCreateData: async ({unit, expirationDate, session, logger, languageCode, company, ...params}: any) => {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            {session, logger, languageCode},
        );

        if (foundUnit.status !== UnitStatus.AVAILABLE) {
            throw apiValidationException("unit_not_available", "", null, languageCode);
        }

        if (expirationDate) {
            const expDate = new Date(expirationDate);
            const todayUtc = new Date();
            todayUtc.setUTCHours(0, 0, 0, 0);
            if (expDate < todayUtc) {
                throw apiValidationException("reservation_expiration_date_must_be_in_the_future", "", null, languageCode);
            }
        }

        const existingReservation = await reservationService.findOne(
            {unit: foundUnit._id, isActive: true},
            {session, logger, languageCode},
        );
        if (existingReservation) {
            throw apiValidationException("unit_already_has_active_reservation", "", null, languageCode);
        }

        return buildCreateDataFromSchemaDef(ReservationSchemaDef, {
            depositAmount: (v) => Decimal128.fromString(String(v)),
        })({
            ...params,
            unit: foundUnit._id,
            expirationDate,
            // System-managed — never set via create form
            paid: undefined,
            isActive: undefined,
            cancellationReason: undefined,
        });
    },
    afterCreate: async (created, {session, logger, languageCode, actionUserCtx, company, unit, client, depositAmount, depositCurrency, expirationDate, reservationContract}) => {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            {session, logger, languageCode},
        );
        foundUnit.status = UnitStatus.RESERVED;
        foundUnit.reservation = created._id;
        foundUnit.$locals = foundUnit.$locals || {};
        foundUnit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await foundUnit.save({session});

        let depositCurrencySymbol: string | undefined;
        if (depositCurrency) {
            try {
                const doc = await currencyService.findOne({_id: new ObjectId(depositCurrency), company: company._id});
                depositCurrencySymbol = doc?.symbol;
            } catch {}
        }

        let unitPriceDisplay: string | undefined;
        try {
            const pc = foundUnit.priceCurrency;
            const pcid = pc instanceof ObjectId
                ? pc
                : pc && typeof pc === "object" && "_id" in pc
                  ? (pc as {_id: ObjectId})._id
                  : undefined;
            const priceCurDoc = pcid ? await currencyService.findOne({_id: new ObjectId(pcid), company: company._id}) : undefined;
            const priceSym = priceCurDoc?.symbol ?? "";
            const lang = languageCode ?? "en-US";
            const amt = formatMoneyAmountForEmail(foundUnit.price.toString(), lang);
            unitPriceDisplay = priceSym ? `${amt} ${priceSym}` : amt;
        } catch {}

        const depositAmountDecimal = depositAmount ? Decimal128.fromString(depositAmount.toString()) : undefined;
        const reservationDepositDisplay = formatReservationDepositForEmailDisplay(
            depositAmountDecimal, depositCurrencySymbol, languageCode ?? "en-US",
        );

        emitNotificationEvent(NotificationEventCodes.RESERVATION_CREATED, {
            receiverIds: [String(client)],
            payload: {
                companyId: company._id.toString(),
                reservationId: created._id.toString(),
                unitId: foundUnit._id.toString(),
                unitNumber: foundUnit.unitNumber,
                depositAmount: depositAmount?.toString(),
                depositCurrencyId: depositCurrency ?? undefined,
                depositCurrencySymbol,
                expirationDate: expirationDate ?? undefined,
                languageCode: languageCode ?? "en-US",
            },
        });

        const reservationContractId = Array.isArray(reservationContract)
            ? (reservationContract as string[]).filter(Boolean)[0]
            : (reservationContract != null && String(reservationContract).trim() !== "" ? String(reservationContract) : undefined);
        const expIso = expirationDate ? new Date(expirationDate).toISOString() : undefined;
        try {
            const emailed = await dispatchReservationClientEmail(
                {
                    clientUserId: client,
                    kind: "created",
                    languageCode: languageCode ?? "en-US",
                    companyId: company._id.toString(),
                    companyName: company.name ?? "",
                    reservationId: created._id.toString(),
                    reservationCode: (created as any).name,
                    unitNumber: foundUnit.unitNumber != null ? String(foundUnit.unitNumber) : undefined,
                    unitDisplayName: foundUnit.name,
                    unitPriceDisplay,
                    reservationDepositDisplay,
                    depositSummary: reservationDepositDisplay,
                    reservationContractMediaId: reservationContractId,
                    expirationDateIso: expIso,
                    expirationDateFormatted: formatReservationExpirationForEmail(expIso, languageCode ?? "en-US"),
                },
                {session},
            );
            if (emailed) {
                await reservationService.updateByIdOrThrow(
                    created._id,
                    {$set: {confirmationEmailSentAt: new Date()}},
                    {session, logger, languageCode, auditUserId: actionUserCtx.userId},
                );
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.debug(`Reservation created client email skipped or failed: ${msg}`);
        }
    },
    beforeDelete: async (params, doc) => {
        const reservation = doc as IReservation;
        const {session, logger, languageCode, actionUserCtx, company, _id} = params;

        const unit = await unitService.findOneOrThrow(
            {_id: reservation.unit, company: company._id},
            {session, logger, languageCode},
        );

        const commission = await commissionService.findOne({
            company: company._id,
            sourceType: CommissionSourceType.RESERVATION,
            sourceId: reservation._id,
        });
        if (commission && commission.status === CommissionStatus.PAID) {
            throw apiValidationException("reservation_cannot_be_deleted_as_it_has_a_paid_commission", "", null, languageCode);
        }
        if (commission) {
            await commissionService.deleteById(
                commission._id,
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }

        const reservationRef = (unit.reservation as any)?._id?.toString() ?? unit.reservation?.toString();
        if (reservationRef === _id) {
            if (unit.status === UnitStatus.RESERVED) {
                unit.status = UnitStatus.AVAILABLE;
            }
            unit.reservation = undefined;
            unit.$locals = unit.$locals || {};
            unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
            await unit.save({session});
        }
    },
    overrideRestoreHandler: async (params) => {
        const {logger, languageCode, session, _id, company, actionUserCtx} = params;

        logger.start(`Restoring Reservation ${_id}...`);
        SchemaGuard.checkModelPermission(Reservation, "restore", actionUserCtx, languageCode);

        const foundReservation = await reservationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const unit = await unitService.findOneOrThrow(
            {_id: foundReservation.unit, company: company._id},
            {session, logger, languageCode},
        );

        if (!([UnitStatus.AVAILABLE, UnitStatus.SOLD] as UnitStatus[]).includes(unit.status) || unit.reservation) {
            throw apiValidationException("reserve_not_available_for_restore", "", null, languageCode);
        }

        await reservationService.restoreOneOrThrow(
            {_id: foundReservation._id, company: company._id},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        if (unit.status === UnitStatus.AVAILABLE) {
            unit.status = UnitStatus.RESERVED;
        }
        unit.reservation = foundReservation;
        unit.$locals = unit.$locals || {};
        unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await unit.save({session});

        const commission = await commissionService.findOne({
            company: company._id,
            sourceType: CommissionSourceType.RESERVATION,
            sourceId: foundReservation._id,
        });
        if (commission) {
            await commissionService.restoreOneOrThrow(
                {_id: commission._id, company: company._id},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }

        logger.finish(`Restored Reservation ${_id}`);
        return {message: "Reservation successfully restored"};
    },
});
