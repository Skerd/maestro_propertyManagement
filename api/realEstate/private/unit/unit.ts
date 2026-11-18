import {Decimal128, ObjectId} from 'mongodb';
import {bulkUpdateUnitPriceFormSchema, bulkUpdateUnitStatusFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unitBulk.form.validator";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {UnitSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.schema-def";
import {mediaUploadMW} from '@coreModule/utilities/middlewares/mediaUploadMW';
import {createCrudRouter, selectIdsOf} from '@coreModule/api/crudRouterFactory';
import {NATURAL_SORT_COLLATION} from '@coreModule/database/services/baseCrudService';
import {floorService} from '../../../../database/schemas/floor/floor.service';
import {edificeService} from '../../../../database/schemas/edifice/edifice.service';
import {projectService} from '../../../../database/schemas/project/project.service';
import {unitService} from '../../../../database/schemas/unit/unit.service';
import {inspectionService} from '../../../../database/schemas/inspection/inspection.service';
import {unitCostService} from '../../../../database/schemas/unitCost/unitCost.service';
import {modificationRequestService} from '../../../../database/schemas/modificationRequest/modificationRequest.service';
import {reservationService} from '../../../../database/schemas/reservation/reservation.service';
import {saleService} from '../../../../database/schemas/sale/sale.service';
import Unit, {type IUnit} from "../../../../database/schemas/unit/unit";
import {unitHub} from "../../../../utilities/services/unitHub";
import UnitType from "../../../../database/schemas/unitType/unitType";
import {unitsToDTO, unitToDTO} from "../../../../utilities/mappers/unit/unitMapper.dto";
import {loadEffectivePriceVisibility} from "../../../../utilities/marketing/priceOnRequestScope.util";
import {unitsToSelect} from "../../../../utilities/mappers/unit/unitMapper.select";
import {createUnitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/createUnit.form.validator";
import {editUnitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/editUnit.form.validator";
import {unitsSelectFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/units.select.form.validator";
import {unitsListFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/units.list.form.validator";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {apiValidationException} from 'armonia/src/modules/core/helpers/exceptions';
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {unitTypeService} from "@propertyManagement/database/schemas/unitType/unitType.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {UnitActions} from '../../../../database/schemas/unit/unit.actions';

async function unitWithHub(unit: IUnit, { actionUserCtx, languageCode, logger, company }: Pick<AuthenticatedMWType, "actionUserCtx" | "languageCode" | "logger" | "company">) {
    const [statisticsByUnitId, effectivePriceVisibility, hub] = await Promise.all([
        unitService.calculateStatistics([unit._id], actionUserCtx, languageCode, { logger }),
        loadEffectivePriceVisibility("unit", unit, { companyId: company._id, logger, languageCode }),
        unitHub(unit._id, { companyId: company._id, actionUserCtx, languageCode }),
    ]);
    return {
        ...unitToDTO(unit, { statistics: statisticsByUnitId[unit._id.toString()] }),
        effectivePriceVisibility,
        ...hub,
    };
}

const mediaUpload = mediaUploadMW({
    fields: { mainImage: 1, imageGallery: 10, videoGallery: 3, mediaFiles: 20, marketingBooklet: 1 },
    fieldMimeTypes: { marketingBooklet: ["application/pdf"] },
    maxFileSize: 250 * 1024 * 1024,
});

export const { router } = createCrudRouter({
    collectionName: "units",
    model:          Unit,
    service:        unitService,
    entityName: "Unit",
    createSchema:   createUnitFormSchema,
    editSchema:     editUnitFormSchema,
    toDTO:          (unit) => unitToDTO(unit),
    toDTOArray:     (units) => unitsToDTO(units),
    toSelect:       unitsToSelect,
    createMiddleware: [mediaUpload],
    editMiddleware:   [mediaUpload],
    enrichList: async (units, { actionUserCtx, languageCode, logger }) => {
        const statisticsByUnitId = await unitService.calculateStatistics(
            units.map((u: any) => u._id), actionUserCtx, languageCode, { logger },
        );
        return unitsToDTO(units, { statisticsByUnitId });
    },
    // The single read is the unit's hub: its sales, reservations, leases, rent, costs, inspections and requests
    // (UX-03, D151); an edit returns it too, so the open sheet keeps its lists.
    enrichSingle: async (unit, params) => unitWithHub(unit, params),
    enrichUpdate: async (unit, params) => unitWithHub(unit, params),
    buildCreateData: async ({ floor, polygonCoordinates, connectedUnits, orientation, constructionStatus, session, logger, languageCode, company, unitType, priceCurrency, ...params }: any) => {

        const [foundFloor, foundUnitType, foundCurrency] = await Promise.all([
            floorService.findOneOrThrow({ _id: new ObjectId(floor), company: company._id }, { session, logger, languageCode, withDeleted: false }),
            unitTypeService.findOneOrThrow({_id: new ObjectId(unitType), company: company._id}, {session, logger, languageCode, withDeleted: false}),
            currencyService.findOneOrThrow({ _id: new ObjectId(priceCurrency) }, { session, logger, languageCode, withDeleted: false }),
        ]);

        let connectedUnitIds: ObjectId[] = [];
        if (connectedUnits && connectedUnits.length > 0) {
            const connectedUnitObjectIds = connectedUnits.map((id: any) => new ObjectId(id));
            const foundConnectedUnits = await unitService.find({ _id: { $in: connectedUnitObjectIds }, company: company._id, edifice: foundFloor.edifice._id }, { session, logger, languageCode, withDeleted: false });
            if (foundConnectedUnits.length !== connectedUnitObjectIds.length) {
                throw apiValidationException("invalid_connected_units", null, null, languageCode);
            }
            connectedUnitIds = connectedUnitObjectIds;
        }

        let data = buildCreateDataFromSchemaDef(UnitSchemaDef, {})({
            ...params,
            floor: foundFloor._id,
            unitType: foundUnitType._id,
            priceCurrency: foundCurrency._id,
            connectedUnits: connectedUnitIds
        });

        // Denormalize edifice and project from floor for fast dashboard queries
        const floorEdificeId = foundFloor.edifice?._id ?? foundFloor.edifice;
        const floorProjectId = foundFloor.project?._id ?? foundFloor.project;
        if (floorEdificeId) data.edifice = new ObjectId(floorEdificeId.toString());
        if (floorProjectId) data.project = new ObjectId(floorProjectId.toString());

        if (polygonCoordinates !== undefined) {
            data.polygonCoordinates = polygonCoordinates.length > 0 ? polygonCoordinates : [];
        }

        if (orientation !== undefined) {
            data.orientation = orientation || undefined;
        }
        if (constructionStatus !== undefined) {
            data.constructionStatus = constructionStatus || undefined;
        }

        // Panel-created units always carry an explicit operator-set price.
        data.priceManuallyEdited = true;

        return data;

    },
    buildUpdateData: async ({ floor, polygonCoordinates, connectedUnits, orientation, constructionStatus, existing, session, logger, languageCode, company, unitType, priceCurrency, ...params }: any, writeFields) => {

        let currentFloorId = existing?.floor?._id ?? existing?.floor;

        let updatedFloor: any = undefined;
        if (floor != null && writeFields.floor) {
            updatedFloor = await floorService.findOneOrThrow({ _id: new ObjectId(floor), company: company._id }, { session, logger, languageCode, withDeleted: false });
            currentFloorId = updatedFloor._id;
        }

        const [foundUnitType, foundCurrency] = await Promise.all([
            unitTypeService.findOneOrThrow({_id: new ObjectId(unitType), company: company._id}, {session, logger, languageCode, withDeleted: false}),
            currencyService.findOneOrThrow({ _id: new ObjectId(priceCurrency) }, { session, logger, languageCode, withDeleted: false }),
        ]);

        const data = buildUpdateDataFromSchemaDef(UnitSchemaDef, {})({
            ...params,
            floor,
            unitType: foundUnitType._id,
            priceCurrency: foundCurrency._id,
            connectedUnits: undefined
        }, writeFields);

        // Keep denormalized edifice/project in sync when floor changes
        if (updatedFloor) {
            const floorEdificeId = updatedFloor.edifice?._id ?? updatedFloor.edifice;
            const floorProjectId = updatedFloor.project?._id ?? updatedFloor.project;
            data.edifice = floorEdificeId ? new ObjectId(floorEdificeId.toString()) : null;
            data.project = floorProjectId ? new ObjectId(floorProjectId.toString()) : null;
        }

        if (polygonCoordinates !== undefined && writeFields.polygonCoordinates) {
            data.polygonCoordinates = polygonCoordinates;
        }

        if (orientation !== undefined && writeFields.orientation) {
            data.orientation = orientation === null ? null : orientation;
        }
        if (constructionStatus !== undefined && writeFields.constructionStatus) {
            data.constructionStatus = constructionStatus === null ? null : constructionStatus;
        }

        if (connectedUnits !== undefined && writeFields.connectedUnits) {
            const currentFloor = await floorService.findOneOrThrow({ _id: currentFloorId }, { logger, languageCode, withDeleted: false });
            const allFloors = await floorService.find({ edifice: currentFloor.edifice }, { logger, languageCode, withDeleted: false }, null, "_id");

            if (Array.isArray(connectedUnits) && connectedUnits.length > 0) {
                const connectedUnitIds = connectedUnits.map((id: any) => new ObjectId(id));
                const foundConnectedUnits = await unitService.find(
                    { _id: { $in: connectedUnitIds }, company: company._id, floor: { $in: allFloors.map((f: any) => f._id) } },
                    { session, logger, languageCode },
                );
                if (foundConnectedUnits.length !== connectedUnitIds.length) {
                    throw apiValidationException("invalid_connected_units", null, null, languageCode);
                }
                const prev = existing.connectedUnit ?? [];
                const previousIds: ObjectId[] = prev.map((x: any) => x instanceof ObjectId ? x : new ObjectId(x._id ?? x));
                const newIdSet = new Set(connectedUnitIds.map((id: any) => id.toString()));
                const toRemove = previousIds.filter((id: any) => !newIdSet.has(id.toString()));
                if (toRemove.length > 0) {
                    await unitService.updateMany({ _id: { $in: toRemove } }, { $pull: { connectedUnits: existing._id } }, { session });
                }
                await unitService.updateMany({ _id: { $in: connectedUnitIds } }, { $addToSet: { connectedUnits: existing._id } }, { session });
                data.connectedUnits = connectedUnitIds;
            } else {
                const prev = existing.connectedUnits ?? [];
                const previousIds: ObjectId[] = prev.map((x: any) => x instanceof ObjectId ? x : new ObjectId(x._id ?? x));
                if (previousIds.length > 0) {
                    await unitService.updateMany({ _id: { $in: previousIds } }, { $pull: { connectedUnits: existing._id } }, { session });
                }
                data.connectedUnits = [];
            }
        }

        return data;
    },
    afterUpdate: async (params, existing) => {
        const { price, priceCurrency, session, logger, languageCode, actionUserCtx } = params;
        const existingUnit = existing;

        const priceChanged = price !== undefined && String(price) !== existingUnit.price?.toString?.();
        const currencyChanged = priceCurrency !== undefined &&
            new ObjectId(priceCurrency).toString() !== (existingUnit.priceCurrency?._id ?? existingUnit.priceCurrency)?.toString?.();

        if (priceChanged || currencyChanged) {
            const updated = await unitService.findById(existingUnit._id, {session, logger, languageCode});
            if (updated) {
                await unitService.updateByIdOrThrow(
                    existingUnit._id,
                    {
                        $set: {priceManuallyEdited: true},
                        $push: {
                            priceHistory: {
                                price: updated.price,
                                currency: updated.priceCurrency?._id ?? updated.priceCurrency,
                                changedAt: new Date(),
                                changedBy: new ObjectId(actionUserCtx.userId),
                            },
                        },
                    },
                    {session, logger, languageCode}
                );
            }
        }
    },
    afterCreate: async (created, { session, logger, languageCode, actionUserCtx }) => {
        const createdUnit = created;

        if (createdUnit.price != null && createdUnit.priceCurrency != null) {
            await unitService.updateByIdOrThrow(
                createdUnit._id,
                {
                    $set: {priceManuallyEdited: true},
                    $push: {
                        priceHistory: {
                            price: createdUnit.price,
                            currency: createdUnit.priceCurrency?._id ?? createdUnit.priceCurrency,
                            changedAt: new Date(),
                            changedBy: new ObjectId(actionUserCtx.userId),
                        },
                    },
                },
                { session, logger, languageCode },
            );
        }

        const connectedUnitIds: ObjectId[] = (created.connectedUnits ?? []).map((id: any) => id instanceof ObjectId ? id : new ObjectId(id._id ?? id));
        if (connectedUnitIds.length > 0) {
            await unitService.updateMany(
                { _id: { $in: connectedUnitIds } },
                { $addToSet: { connectedUnits: created._id } },
                { session },
            );
        }
    },
    actions:        UnitActions,
    selectSchema:   unitsSelectFormSchema,
    listSchema:     unitsListFormSchema,
    // reservedBy / boughtFrom live on the Reservation / Sale documents, not the unit,
    // so they can't go through the DSL filter engine. Resolve them here: find the
    // reservation/sale docs for the chosen user, then match units whose own current
    // reservation/sale reference is in that set (the unit clears these refs when it is
    // no longer reserved/sold, keeping the filter accurate to the current state).
    // To filter by the customer instead of the agent, switch `reservedBy` → `client`
    // (and keep `buyer`, which already is the customer on the sale).
    extraListFilter: async ({ reservedBy, boughtFrom, company, logger, languageCode }: any) => {
        const out: Record<string, unknown> = {};
        if (reservedBy) {
            const reservations = await reservationService.find(
                { reservedBy: new ObjectId(reservedBy), company: company._id },
                { logger, languageCode }, undefined, "_id",
            );
            out.reservation = { $in: reservations.map((r: any) => r._id) };
        }
        if (boughtFrom) {
            const sales = await saleService.find(
                { buyer: new ObjectId(boughtFrom), company: company._id },
                { logger, languageCode }, undefined, "_id",
            );
            out.sale = { $in: sales.map((s: any) => s._id) };
        }
        return out;
    },
    // In unit-number order, the way a building is walked (UX-12), with "Floor 2" before "Floor 10" (D165).
    defaultSort:    { unitNumber: 1 },
    selectSort:     { unitNumber: 1 },
    naturalSort:    true,
    overrideSelectHandler: async (params) => {
        const { logger, languageCode, actionUserCtx, company, name, page, limit, notId, notConnected, dslFilterQuery, project, edifice, floor } = params;
        logger.start(`Fetching units for select...`);

        const sanitizedFields = SchemaGuard.sanitizeFields(Unit, { name: {}, unitNumber: {}, unitType: { keys: { name: {} } } }, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(sanitizedFields, Unit.schema);

        // Forms post the picked project, building and floor so the picker lists only their units. A stored unit keeps its
        // label whatever the form narrows the list to (TD-B217).
        const ids = selectIdsOf(params);
        const filter: any = ids.length > 0
            ? { company: company._id, _id: { $in: ids } }
            : { company: company._id, ...unitSelectFilter({ project, edifice, floor }) };

        if (ids.length === 0 && dslFilterQuery && Object.keys(dslFilterQuery as object).length > 0) {
            filter.$and = [...((filter.$and as unknown[]) ?? []), dslFilterQuery];
        }

        if (ids.length === 0 && name !== undefined && name !== "") {
            const nameRegex = { $regex: escapeRegex(String(name).trim()), $options: "i" };
            const orConditions: any[] = [];
            if (sanitizedFields.unitNumber) orConditions.push({ unitNumber: nameRegex });
            if (sanitizedFields.name)       orConditions.push({ name: nameRegex });
            if (sanitizedFields.unitType?.keys?.name) {
                try {
                    const unitTypeSanitized = SchemaGuard.sanitizeFields(UnitType, { name: {} }, "read", actionUserCtx, languageCode);
                    if (unitTypeSanitized?.name) {
                        const matchingTypes = await unitService.find({ name: nameRegex }, { logger, languageCode, withDeleted: false }, undefined, "_id");
                        if (matchingTypes.length > 0) {
                            orConditions.push({ unitType: { $in: matchingTypes.map((ut: any) => ut._id) } });
                        }
                    }
                } catch (_) {}
            }
            if (orConditions.length === 1) Object.assign(filter, orConditions[0]);
            else if (orConditions.length > 1) filter.$or = orConditions;
        }
        if (ids.length === 0 && notId !== undefined && notId !== "") {
            filter._id = { $ne: new ObjectId(notId) };
        }
        if (ids.length === 0 && notConnected === true) {
            const currentUnitId = notId ? new ObjectId(notId) : null;
            const notConnectedCondition = currentUnitId
                ? { $or: [{ connectedUnits: { $size: 0 } }, { connectedUnits: currentUnitId }] }
                : { connectedUnits: { $size: 0 } };
            if (filter.$or) {
                filter.$and = [...((filter.$and as unknown[]) ?? []), { $or: filter.$or }, notConnectedCondition];
                delete filter.$or;
            } else {
                Object.assign(filter, notConnectedCondition);
            }
        }

        const [units, total] = await Promise.all([
            unitService.find(filter, { logger, languageCode, collation: NATURAL_SORT_COLLATION }, populate.populate, populate.select || "", { unitNumber: 1 }, limit, (page - 1) * limit),
            unitService.count(filter, { logger, languageCode }),
        ]);

        logger.finish(`Finished fetching units for select!`);
        return { data: unitsToSelect(units), total };
    },
    beforeDelete: async () => {},
    afterDelete: async ({ _id, session, logger, languageCode, actionUserCtx }) => {
        await Promise.all([
            inspectionService.deleteMany(         { unit: new ObjectId(_id) }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            unitCostService.deleteMany(           { unit: new ObjectId(_id) }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            modificationRequestService.deleteMany({ unit: new ObjectId(_id) }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            reservationService.deleteMany(        { unit: new ObjectId(_id) }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            saleService.deleteMany(               { unit: new ObjectId(_id) }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
        ]);
    },
});

export const basePath = '/api/realEstate/unit';

// ── PATCH /bulk/updatePrice ───────────────────────────────────────────────────

import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {transactionHandler} from "@coreModule/utilities/middlewares/transactionHandler";
import {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";

router.patch(
    "/bulk/updatePrice",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 10}),
    validateFormZod(bulkUpdateUnitPriceFormSchema),
    transactionHandler(),
    asyncHandler(bulkUpdateUnitPrice),
);

type BulkUpdatePriceParams = AuthenticatedMWType & TransactionRequiredParams & {
    unitIds: string[];
    price: number;
    priceCurrency: string;
    reason?: string;
};

async function bulkUpdateUnitPrice(params: BulkUpdatePriceParams): Promise<{updatedCount: number}> {
    const {logger, languageCode, session, unitIds, price, priceCurrency, reason, actionUserCtx, company} = params;

    logger.start(`Bulk price update for ${unitIds.length} units...`);

    SchemaGuard.sanitizeFields(Unit, {price: {}, priceCurrency: {}}, "write", actionUserCtx, languageCode);
    await currencyService.findOneOrThrow({_id: new ObjectId(priceCurrency)}, {session, logger, languageCode});

    const unitObjectIds = unitIds.map(id => new ObjectId(id));
    const newPrice = Decimal128.fromString(String(price));
    const newCurrencyId = new ObjectId(priceCurrency);

    const result = await unitService.updateMany({_id: {$in: unitObjectIds}, company: company._id}, {
            $set: {price: newPrice, priceCurrency: newCurrencyId, priceManuallyEdited: true},
            $push: {
                priceHistory: {
                    price:     newPrice,
                    currency:  newCurrencyId,
                    changedAt: new Date(),
                    changedBy: new ObjectId(actionUserCtx.userId),
                    reason:    reason?.trim() || "Bulk price update",
                },
            },
        }, {session: session});

    logger.finish(`Bulk price update complete: ${result.modifiedCount} units updated`);
    return {updatedCount: result.modifiedCount};
}

// ── PATCH /bulk/updateStatus ──────────────────────────────────────────────────

router.patch(
    "/bulk/updateStatus",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 10}),
    validateFormZod(bulkUpdateUnitStatusFormSchema),
    transactionHandler(),
    asyncHandler(bulkUpdateUnitStatus),
);

type BulkUpdateStatusParams = AuthenticatedMWType & TransactionRequiredParams & {
    unitIds: string[];
    status: UnitStatus.AVAILABLE | UnitStatus.UNAVAILABLE;
};

async function bulkUpdateUnitStatus(params: BulkUpdateStatusParams): Promise<{updatedCount: number; skippedCount: number}> {
    const {logger, languageCode, session, unitIds, status, actionUserCtx, company} = params;

    logger.start(`Bulk status update to "${status}" for ${unitIds.length} units...`);

    SchemaGuard.sanitizeFields(Unit, {status: {}}, "write", actionUserCtx, languageCode);

    const unitObjectIds = unitIds.map(id => new ObjectId(id));

    // Only update units currently in AVAILABLE or UNAVAILABLE — skip SOLD/RESERVED
    const result = await unitService.updateMany({
            _id:     {$in: unitObjectIds},
            company: company._id,
            status:  {$in: [UnitStatus.AVAILABLE, UnitStatus.UNAVAILABLE]},
        }, {
            ...(status === UnitStatus.AVAILABLE
                ? {$set: {status}, $unset: {unavailableNotes: ""}}
                : {$set: {status}}),
        }, {session: session});

    const skippedCount = unitIds.length - result.matchedCount;
    logger.finish(`Bulk status update complete: ${result.modifiedCount} updated, ${skippedCount} skipped (sold/reserved)`);
    return {updatedCount: result.modifiedCount, skippedCount};
}

// ── POST /availability ────────────────────────────────────────────────────────
// The reservation and sale windows of the chosen units that overlap the requested calendar days.

import type {UnitAvailabilityResponse} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unitAvailability.response.type";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {
    type UnitAvailabilityForm,
    unitAvailabilityFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unitAvailability.form.validator";
import {assertAnyCollectedRead, canReadCollectedFields} from "@propertyManagement/utilities/security/canReadCollectedFields";
import {unitSelectFilter} from "@propertyManagement/utilities/unit/unitSelectFilter";

import {addLocalDays, localDateOf} from "@coreModule/utilities/time/timeWindows";

router.post(
    "/availability",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(unitAvailabilityFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & UnitAvailabilityForm): Promise<UnitAvailabilityResponse> => {
        const {company, languageCode, logger, actionUserCtx, unitId, projectId, floorId, dateFrom, dateTo} = params;
        assertAnyCollectedRead(canReadCollectedFields("units", actionUserCtx, languageCode), languageCode);
        const canReadReservations = canReadCollectedFields("reservations", actionUserCtx, languageCode);
        const canReadSales = canReadCollectedFields("sales", actionUserCtx, languageCode);

        // Calendar days (`YYYY-MM-DD`, D115), both included; without a range, 90 days back to a year ahead of the
        // company's today. Reservation and sale days compare as text; an end that is an instant (cancelled, expired)
        // counts on its company day.
        const timeZone = params.companyTimeZone;
        const today = localDateOf(new Date(), timeZone);
        const from = dateFrom || addLocalDays(today, -90);
        const to   = dateTo   || addLocalDays(today, 365);
        const endDay = (end: Date | string | undefined): string | undefined =>
            end instanceof Date ? localDateOf(end, timeZone) : end || undefined;

        const unitFilter: Record<string, unknown> = {company: company._id};
        if (unitId)    unitFilter._id     = new ObjectId(unitId);
        if (projectId) unitFilter.project = new ObjectId(projectId);
        if (floorId)   unitFilter.floor   = new ObjectId(floorId);

        const units = await unitService.find(unitFilter, {logger, languageCode}, null, "_id name unitNumber status floor project");

        const unitIds  = units.map((u: any) => u._id);
        if (unitIds.length === 0) {
            return {entries: [], dateFrom: from, dateTo: to};
        }

        // Windows that start before the range ends; those that also end before it starts are dropped below.
        const [reservations, sales] = await Promise.all([
            canReadReservations
                ? reservationService.findUnitHistoryLean({unit: {$in: unitIds}, company: company._id, reservationDate: {$lte: to}})
                : [],
            canReadSales
                ? saleService.findUnitHistoryLean({unit: {$in: unitIds}, company: company._id, saleDate: {$lte: to}})
                : [],
        ]);

        const resByUnit   = new Map<string, any[]>();
        const saleByUnit  = new Map<string, any[]>();
        for (const r of reservations) {
            const end = endDay(r.cancelledAt ?? r.expiredAt ?? r.expirationDate);
            if (end && end < from) continue;
            const key = r.unit.toString();
            if (!resByUnit.has(key)) resByUnit.set(key, []);
            resByUnit.get(key)!.push(r);
        }
        for (const s of sales) {
            const key = s.unit.toString();
            if (!saleByUnit.has(key)) saleByUnit.set(key, []);
            saleByUnit.get(key)!.push(s);
        }

        const entries = units.map((unit: any) => {
            const unitKey   = unit._id.toString();
            const windows: UnitAvailabilityResponse["entries"][number]["windows"] = [];

            for (const r of resByUnit.get(unitKey) ?? []) {
                const start: string | undefined = r.reservationDate || undefined;
                if (!start) continue;
                windows.push({
                    type:      "reserved",
                    status:    r.status ?? "active",
                    start,
                    end:       endDay(r.cancelledAt ?? r.expiredAt ?? r.expirationDate),
                    reference: r.name,
                });
            }

            for (const s of saleByUnit.get(unitKey) ?? []) {
                windows.push({
                    type:      "sold",
                    status:    s.status ?? "sold",
                    start:     s.saleDate || today,
                    reference: s.name,
                });
            }

            windows.sort((a, b) => a.start.localeCompare(b.start));

            return {
                unit: {
                    _id:        unit._id.toString(),
                    name:       unit.name,
                    unitNumber: unit.unitNumber,
                    status:     unit.status,
                    floor:      unit.floor ? {_id: unit.floor._id?.toString() ?? unit.floor.toString(), name: unit.floor.name} : undefined,
                    project:    unit.project ? {_id: unit.project._id?.toString() ?? unit.project.toString(), name: unit.project.name} : undefined,
                },
                windows,
            };
        });

        return {entries, dateFrom: from, dateTo: to};
    }),
);

