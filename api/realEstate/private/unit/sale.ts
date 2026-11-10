import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {schemaSanitizer, type SchemaSanitizerMWType} from "@coreModule/utilities/middlewares/schemaSanitizerMW";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter, type CrudLooseBody} from "@coreModule/api/crudRouterFactory";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {saleService} from "../../../../database/schemas/sale/sale.service";
import {unitService} from "../../../../database/schemas/unit/unit.service";
import {paymentPlanService} from "../../../../database/schemas/paymentPlan/paymentPlan.service";
import {commissionService} from "../../../../database/schemas/commission/commission.service";
import Sale, {type ISale} from "../../../../database/schemas/sale/sale";
import PaymentPlan from "../../../../database/schemas/paymentPlan/paymentPlan";
import {CommissionSourceType, CommissionStatus} from "../../../../database/schemas/commission/commission";
import {releaseSale, retakeSale} from "../../../../database/schemas/sale/sale.helper";
import {buildSaleCreateData, completeSaleCreation} from "../../../../workflows/saleCreation";
import {saleToDTO, salesToDTO} from "@propertyManagement/utilities/mappers/sale/saleMapper.dto";
import {paymentPlanToDTO} from "@propertyManagement/utilities/mappers/paymentPlan/paymentPlanMapper.dto";
import {salesToSelect} from "@propertyManagement/utilities/mappers/sale/saleMapper.select";
import {generatePaymentPlanPdf} from "@propertyManagement/utilities/pdf/paymentPlanPdf";
import {createSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/createSale.form.validator";
import type {CreateSaleFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/createSale.form.type";
import {editSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/editSale.form.validator";
import type {EditSaleFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/editSale.form.type";
import {saleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.form.validator";
import {SaleActions} from "../../../../database/schemas/sale/sale.actions";
import type {PaymentPlan as PaymentPlanData} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/paymentPlan/paymentPlan.dto";
import authMW, {type AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import type {Request, Response} from "express";
import type {SingleForm} from "armonia/src/modules/core/types/shared.types";
import {salesWithHandoverContext} from "@propertyManagement/utilities/handoverPackage/handoverPackageChecklist";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";

export const basePath = "/api/realEstate/unit/sale";

// ─────────────────────────────────────────────────────────────────────────────
// createCrudRouter
// ─────────────────────────────────────────────────────────────────────────────

/** The sales list narrowed to a unit, or to the units of a project / edifice / floor. */
async function saleExtraListFilter(params: AuthenticatedMWType & CrudLooseBody): Promise<Record<string, unknown>> {
    const {unit, project, edifice, floor, company, logger, languageCode} = params;
    const opts = {logger, languageCode, withDeleted: false as const};
    const filter: Record<string, unknown> = {};

    if (unit && ObjectId.isValid(unit)) {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            opts,
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
            opts,
            undefined,
            "_id",
        );
        filter.unit = {$in: units.map((u) => u._id)};
    }

    return filter;
}

const {router} = createCrudRouter<ISale, CreateSaleFormType, EditSaleFormType>({
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
        const {logger, languageCode, actionUserCtx, company, name, page, limit, dslFilterQuery} = params;

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

    // ── Create: unified cash + payment-plan sale (workflows/saleCreation) ───
    buildCreateData: buildSaleCreateData,
    afterCreate: completeSaleCreation,

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
        const {languageCode, company} = params;
        const commission = await commissionService.findOne({
            company: company._id,
            sourceType: CommissionSourceType.SALE,
            sourceId: doc._id,
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
        const {logger, languageCode, session, _id, company, actionUserCtx} = params;

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
    asyncHandler(async (params: AuthenticatedMWType & SchemaSanitizerMWType & SingleForm): Promise<PaymentPlanData> => {
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
