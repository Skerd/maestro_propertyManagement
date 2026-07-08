import {Decimal128, ObjectId} from "mongodb";
import {ClientSession} from "mongoose";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {unitCostService} from "../../../../database/schemas/unitCost/unitCost.service";
import {unitService} from "../../../../database/schemas/unit/unit.service";
import {floorService} from "../../../../database/schemas/floor/floor.service";
import {edificeService} from "../../../../database/schemas/edifice/edifice.service";
import {projectService} from "../../../../database/schemas/project/project.service";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import UnitCost from "../../../../database/schemas/unitCost/unitCost";
import {generateZodCreateUnitCostFormSchema, unitCostFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/createUnitCost.form.validator";
import {editUnitCostFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/editUnitCost.form.validator";
import {validateUnitCostSelectForm} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.select.form.validator";
import {unitCostsToDTO, unitCostToDTO} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.dto";
import {unitCostsToSelect} from "@propertyManagement/utilities/mappers/unitCost/unitCostMapper.select";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    MAX_MEDIA_FILES_PER_EXPENDITURE_LINE,
    MAX_TOTAL_EXPENDITURE_LINE_MEDIA_UPLOADS,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.constants";
import {
    buildUnitCostVisibilityOrClause,
    objectIdFromRef,
    resolveHierarchySetsFromUnitIds,
} from "../../../../database/schemas/unitCost/unitCostHierarchy.util";

export const basePath = "/api/realEstate/unit/cost";

function toMediaIds(v: unknown): ObjectId[] {
    if (v === undefined || v === null || v === "") return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr.filter(Boolean).map((id) => new ObjectId(String(id)));
}

type ExpenditureRowInput = {
    title: string;
    category: string;
    amount: number;
    unit: string;
    pricePerUnit: string | number;
    media: string[];
};

function normalizeExpenditureItemsInput(
    items: Array<{
        title: string;
        category: string;
        amount: number;
        unit: string;
        pricePerUnit: string | number;
        media?: unknown;
    }>,
): ExpenditureRowInput[] {
    return items.map((row) => ({
        title: row.title,
        category: row.category,
        amount: row.amount,
        unit: row.unit,
        pricePerUnit: row.pricePerUnit,
        media: Array.isArray(row.media)
            ? row.media.map((id) => String(id)).filter((id) => ObjectId.isValid(id))
            : [],
    }));
}

function mergeExpenditureLineUploadedMedia(
    items: ExpenditureRowInput[],
    uploadedIds: ObjectId[],
    rowIndices: number[],
    languageCode: string,
): void {
    if (uploadedIds.length === 0) return;
    if (uploadedIds.length !== rowIndices.length) {
        throw apiValidationException("form_not_correct", "expenditure_line_media_upload_mismatch", null, languageCode);
    }
    for (let i = 0; i < uploadedIds.length; i++) {
        const ri = rowIndices[i];
        if (!Number.isInteger(ri) || ri < 0 || ri >= items.length) {
            throw apiValidationException("form_not_correct", "expenditure_line_media_invalid_row", null, languageCode);
        }
        if (items[ri].media.length >= MAX_MEDIA_FILES_PER_EXPENDITURE_LINE) {
            throw apiValidationException("form_not_correct", "expenditure_line_media_limit", null, languageCode);
        }
        items[ri].media.push(uploadedIds[i].toString());
    }
}

function mapExpenditureItemsForDb(items: ExpenditureRowInput[]): any[] {
    return items.map((row) => ({
        title: row.title,
        category: row.category,
        amount: row.amount,
        unit: row.unit,
        pricePerUnit: row.pricePerUnit,
        media: row.media.map((id) => new ObjectId(id)),
    }));
}

function buildExpenditureItems(
    expenditureItems: unknown,
    expenditureItemMedia: unknown,
    expenditureItemMediaRowIndex: unknown,
    languageCode: string,
): any[] {
    const rawItems = Array.isArray(expenditureItems) ? expenditureItems : [];
    const itemsNorm = normalizeExpenditureItemsInput(rawItems as any);
    const uploadedLineIds = toMediaIds(expenditureItemMedia);
    const rowIndices = Array.isArray(expenditureItemMediaRowIndex)
        ? expenditureItemMediaRowIndex.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0)
        : [];
    mergeExpenditureLineUploadedMedia(itemsNorm, uploadedLineIds, rowIndices, languageCode);
    return mapExpenditureItemsForDb(itemsNorm);
}

async function resolveCreateUnitCostScope(
    body: {unit?: string; floor?: string; edifice?: string; project?: string},
    company: {_id: ObjectId},
    session: ClientSession | undefined,
    logger: any,
    languageCode: string,
) {
    const opts = {session, logger, languageCode};
    const u = body.unit?.trim();
    const f = body.floor?.trim();
    const e = body.edifice?.trim();
    const p = body.project?.trim();

    if (u && ObjectId.isValid(u)) {
        const foundUnit = await unitService.findOneOrThrow({_id: new ObjectId(u), company: company._id}, opts);
        const floorId = objectIdFromRef(foundUnit.floor);
        if (!floorId) throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
        const floorDoc = await floorService.findOneOrThrow({_id: floorId, company: company._id}, opts);
        const edificeId = objectIdFromRef(floorDoc.edifice);
        if (!edificeId) throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
        const edificeDoc = await edificeService.findOneOrThrow({_id: edificeId, company: company._id}, opts);
        const projectId = objectIdFromRef(edificeDoc.project);
        if (!projectId) throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
        return {unit: foundUnit._id, floor: floorDoc._id, edifice: edificeDoc._id, project: projectId};
    }
    if (f && ObjectId.isValid(f)) {
        const floorDoc = await floorService.findOneOrThrow({_id: new ObjectId(f), company: company._id}, opts);
        const edificeId = objectIdFromRef(floorDoc.edifice);
        if (!edificeId) throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
        const edificeDoc = await edificeService.findOneOrThrow({_id: edificeId, company: company._id}, opts);
        const projectId = objectIdFromRef(edificeDoc.project);
        if (!projectId) throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
        return {floor: floorDoc._id, edifice: edificeDoc._id, project: projectId};
    }
    if (e && ObjectId.isValid(e)) {
        const edificeDoc = await edificeService.findOneOrThrow({_id: new ObjectId(e), company: company._id}, opts);
        const projectId = objectIdFromRef(edificeDoc.project);
        if (!projectId) throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
        return {edifice: edificeDoc._id, project: projectId};
    }
    if (p && ObjectId.isValid(p)) {
        await projectService.findOneOrThrow({_id: new ObjectId(p), company: company._id}, opts);
        return {project: new ObjectId(p)};
    }
    throw apiValidationException("form_not_correct", "unit_cost_scope_required", null, languageCode);
}

async function buildUnitVisibilityFilter(
    unitId: string,
    companyId: ObjectId,
    opts: {logger: any; languageCode: string},
): Promise<Record<string, unknown>> {
    await unitService.findOneOrThrow({_id: new ObjectId(unitId), company: companyId}, opts);
    const sets = await resolveHierarchySetsFromUnitIds([new ObjectId(unitId)], opts);
    const orClause = buildUnitCostVisibilityOrClause([new ObjectId(unitId)], sets);
    return {$and: [{$or: orClause}]};
}

const mediaUpload = mediaUploadMW({
    fields: {
        expenditureItemMedia: MAX_TOTAL_EXPENDITURE_LINE_MEDIA_UPLOADS,
        invoiceMedia: 20,
    },
    maxFileSize: 100 * 1024 * 1024,
});

export const {router} = createCrudRouter({
    collectionName: "unitcosts",
    model: UnitCost,
    service: unitCostService,
    createSchema: generateZodCreateUnitCostFormSchema,
    editSchema: editUnitCostFormSchema,
    listSchema: unitCostFormSchema,
    selectSchema: validateUnitCostSelectForm,
    toDTO: unitCostToDTO,
    toDTOArray: unitCostsToDTO,
    toSelect: unitCostsToSelect,
    defaultSort: {purchaseDate: -1},
    selectSort: {purchaseDate: -1},
    createMiddleware: [mediaUpload],
    editMiddleware: [mediaUpload],
    overrideSelectHandler: async (params) => {
        const {logger, languageCode, actionUserCtx, company, name, page, limit, notId, dslFilterQuery} = params;
        logger.start(`Fetching unit costs for select...`);

        const sanitizedFields = SchemaGuard.sanitizeFields(UnitCost, {name: {}, unit: {keys: {name: {}, unitNumber: {}}}}, "read", actionUserCtx, languageCode);
        const populate = SchemaGuard.generatePopulate(sanitizedFields, UnitCost.schema);

        const filter: Record<string, unknown> = {company: company._id};
        if (dslFilterQuery && Object.keys(dslFilterQuery as object).length > 0) {
            filter.$and = [...((filter.$and as unknown[]) ?? []), dslFilterQuery];
        }
        if (notId && ObjectId.isValid(notId)) filter._id = {$ne: new ObjectId(notId)};
        if (name?.trim()) filter.name = {$regex: name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i"};

        const [costs, total] = await Promise.all([
            unitCostService.find(filter, {logger, languageCode}, populate.populate, populate.select || "", {purchaseDate: -1}, limit, (page - 1) * limit),
            unitCostService.count(filter, {logger, languageCode}),
        ]);

        logger.finish(`Finished fetching unit costs for select!`);
        return {data: unitCostsToSelect(costs), total};
    },
    extraListFilter: async (params) => {
        const {id, unitId, verificationStatus, paymentStatus, tag, company, logger, languageCode} = params;

        if (id && ObjectId.isValid(id)) return {_id: new ObjectId(id)};

        const extra: Record<string, unknown> = {};
        if (unitId && ObjectId.isValid(unitId)) {
            Object.assign(extra, await buildUnitVisibilityFilter(unitId, company._id, {logger, languageCode}));
        }
        if (verificationStatus) extra.verificationStatus = verificationStatus;
        if (paymentStatus) extra.paymentStatus = paymentStatus;
        if (tag?.trim()) extra.tag = tag.trim().toLowerCase();
        return extra;
    },
    buildCreateData: async (params) => {
        const {
            unit, floor, edifice, project,
            purchasePerson, purchaseDate, currency,
            verificationStatus, paymentStatus, paymentDate,
            notes, tag, invoiceNumber, vendorName,
            relatedModificationRequest,
            expenditureItemMedia, expenditureItemMediaRowIndex, invoiceMedia,
            expenditureItems,
            budgetedAmount, budgetCurrency,
            company, session, logger, languageCode,
        } = params;

        const scope = await resolveCreateUnitCostScope({unit, floor, edifice, project}, company, session, logger, languageCode);

        return {
            ...(scope.unit    ? {unit: scope.unit}       : {}),
            ...(scope.floor   ? {floor: scope.floor}     : {}),
            ...(scope.edifice ? {edifice: scope.edifice} : {}),
            ...(scope.project ? {project: scope.project} : {}),
            purchasePerson: new ObjectId(purchasePerson),
            purchaseDate: new Date(purchaseDate),
            currency: new ObjectId(currency),
            verificationStatus: verificationStatus ?? "pending_verification",
            paymentStatus: paymentStatus ?? "unpaid",
            paymentDate: paymentDate ? new Date(paymentDate) : undefined,
            notes: notes || "",
            tag: tag?.trim() ? tag.trim().toLowerCase() : undefined,
            invoiceNumber: invoiceNumber?.trim() || undefined,
            vendorName: vendorName?.trim() || undefined,
            relatedModificationRequest:
                relatedModificationRequest && String(relatedModificationRequest).trim()
                    ? new ObjectId(String(relatedModificationRequest))
                    : undefined,
            invoiceMedia: toMediaIds(invoiceMedia),
            expenditureItems: buildExpenditureItems(expenditureItems, expenditureItemMedia, expenditureItemMediaRowIndex, languageCode),
            budgetedAmount: budgetedAmount != null ? Decimal128.fromString(String(budgetedAmount)) : undefined,
            budgetCurrency: budgetCurrency ? new ObjectId(budgetCurrency) : undefined,
        };
    },
    afterCreate: async (created, params) => {
        const {session, logger, languageCode, actionUserCtx} = params;
        const unitId = (created.unit as any)?._id ?? created.unit;
        if (unitId) {
            await unitService.updateByIdOrThrow(
                new ObjectId(unitId.toString()),
                {$push: {costs: created._id}},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId, auditAction: "create"},
            );
        }
    },
    buildUpdateData: async (params, writeFields) => {
        const {
            purchasePerson, purchaseDate, currency,
            verificationStatus, paymentStatus, paymentDate,
            notes, tag, invoiceNumber, vendorName,
            relatedModificationRequest,
            expenditureItemMedia, expenditureItemMediaRowIndex, invoiceMedia,
            expenditureItems,
            budgetedAmount, budgetCurrency,
            languageCode,
        } = params;

        const update: Record<string, any> = {};

        if (purchasePerson !== undefined && writeFields.purchasePerson)   update.purchasePerson = new ObjectId(purchasePerson);
        if (purchaseDate  !== undefined && writeFields.purchaseDate)       update.purchaseDate = new Date(purchaseDate);
        if (currency      !== undefined && writeFields.currency)           update.currency = new ObjectId(currency);
        if (verificationStatus !== undefined && writeFields.verificationStatus) update.verificationStatus = verificationStatus;
        if (paymentStatus !== undefined && writeFields.paymentStatus)      update.paymentStatus = paymentStatus;
        if (paymentDate   !== undefined && writeFields.paymentDate)        update.paymentDate = paymentDate ? new Date(paymentDate) : null;
        if (notes         !== undefined && writeFields.notes)              update.notes = notes;
        if (tag           !== undefined && writeFields.tag)                update.tag = tag?.trim() ? tag.trim().toLowerCase() : null;
        if (invoiceNumber !== undefined && writeFields.invoiceNumber)      update.invoiceNumber = invoiceNumber?.trim() || null;
        if (vendorName    !== undefined && writeFields.vendorName)         update.vendorName = vendorName?.trim() || null;
        if (relatedModificationRequest !== undefined && writeFields.relatedModificationRequest) {
            update.relatedModificationRequest =
                relatedModificationRequest && String(relatedModificationRequest).trim()
                    ? new ObjectId(String(relatedModificationRequest))
                    : null;
        }
        if (invoiceMedia !== undefined && writeFields.invoiceMedia) {
            update.invoiceMedia = toMediaIds(invoiceMedia);
        }
        if (expenditureItems !== undefined && writeFields.expenditureItems) {
            update.expenditureItems = buildExpenditureItems(expenditureItems, expenditureItemMedia, expenditureItemMediaRowIndex, languageCode);
        }
        if (budgetedAmount !== undefined && writeFields.budgetedAmount) {
            update.budgetedAmount = budgetedAmount === null ? null : Decimal128.fromString(String(budgetedAmount));
        }
        if (budgetCurrency !== undefined && writeFields.budgetCurrency) {
            update.budgetCurrency = budgetCurrency === null ? null : new ObjectId(budgetCurrency);
        }

        return update;
    },
    afterDelete: async (params, doc) => {
        const {session, logger, languageCode, actionUserCtx} = params;
        const unitId = (doc.unit as any)?._id ?? doc.unit;
        if (unitId) {
            await unitService.updateByIdOrThrow(
                new ObjectId(unitId.toString()),
                {$pull: {costs: doc._id}},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId},
            );
        }
    },
    overrideRestoreHandler: async (params) => {
        const {logger, languageCode, session, _id, company, actionUserCtx} = params;
        logger.start(`Restoring unit cost ${_id}...`);
        SchemaGuard.checkModelPermission(UnitCost, "restore", actionUserCtx, languageCode);

        const restored = await unitCostService.restoreOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );

        const unitId = (restored.unit as any)?._id ?? restored.unit;
        if (unitId) {
            await unitService.findOneOrThrow({_id: new ObjectId(unitId.toString()), company: company._id}, {session, logger, languageCode});
            await unitService.updateByIdOrThrow(
                new ObjectId(unitId.toString()),
                {$push: {costs: restored._id}},
                {session, logger, languageCode, auditUserId: actionUserCtx.userId, auditAction: "restore"},
            );
        }

        return {message: "Unit cost successfully restored"};
    },
});