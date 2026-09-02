import {Decimal128, ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {RentalPaymentSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {createRentalPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/createRentalPayment.form.validator";
import {editRentalPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/editRentalPayment.form.validator";
import {rentalPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.form.validator";
import RentalPayment, {RentalPaymentStatus} from "../../../database/schemas/rentalPayment/rentalPayment";
import {rentalPaymentService} from "../../../database/schemas/rentalPayment/rentalPayment.service";
import {RentalPaymentActions} from "../../../database/schemas/rentalPayment/rentalPayment.actions";
import {rentalPaymentToDTO, rentalPaymentsToDTO} from "../../../utilities/mappers/rentalPayment/rentalPaymentMapper.dto";
import {rentalPaymentsToSelect} from "../../../utilities/mappers/rentalPayment/rentalPaymentMapper.select";
import {leaseService} from "../../../database/schemas/lease/lease.service";
import {LeaseStatus} from "../../../database/schemas/lease/lease";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {hasCollectedCash} from "../../../utilities/lease/rentRemaining";

const uploadMW = mediaUploadMW({maxFiles: 1, maxFileSize: 25 * 1024 * 1024});
const dateTransform  = (v: unknown) => new Date(v as string);
const moneyTransform = (v: unknown) => Decimal128.fromString(String(v));

async function rentalPaymentExtraListFilter(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {unit, project, edifice, floor, lease, status, company, logger, languageCode} = params as {
        unit?: string;
        project?: string;
        edifice?: string;
        floor?: string;
        lease?: string;
        status?: string;
        company: {_id: ObjectId};
        logger: unknown;
        languageCode: string;
    };
    const opts = {logger, languageCode, withDeleted: false as const};
    const filter: Record<string, unknown> = {};

    if (lease && ObjectId.isValid(lease)) filter.lease = new ObjectId(String(lease));
    if (status) filter.status = status;

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

export const {router} = createCrudRouter({
    collectionName:    "rentalpayments",
    model:             RentalPayment,
    service:           rentalPaymentService,
    entityName:        "RentalPayment",
    listSchema:        rentalPaymentFormSchema,
    createSchema:      createRentalPaymentFormSchema,
    editSchema:        editRentalPaymentFormSchema,
    toDTO:             rentalPaymentToDTO,
    toDTOArray:        rentalPaymentsToDTO,
    toSelect:          rentalPaymentsToSelect,
    defaultSort:       {dueDate: -1},
    selectSearchField: "name",
    createMiddleware:  [uploadMW],
    editMiddleware:    [uploadMW],
    actions:           RentalPaymentActions,
    extraListFilter:   rentalPaymentExtraListFilter,
    extraSelectFilter: async ({lease}: any) => lease && lease !== "" && ObjectId.isValid(String(lease))
        ? {lease: new ObjectId(String(lease))}
        : {},
    buildCreateData: async (params: any) => {
        const {fileIds, session, logger, languageCode, company, ...rest} = params;
        const leaseId = new ObjectId(String(rest.lease));
        const lease = await leaseService.findOneOrThrow(
            {_id: leaseId, company: company._id},
            {session, logger, languageCode},
        );
        if (lease.status !== LeaseStatus.ACTIVE) {
            throw apiValidationException("lease_not_active", "", null, languageCode);
        }

        const leaseUnitId = (lease.unit as any)?._id ?? lease.unit;
        const data = buildCreateDataFromSchemaDef(RentalPaymentSchemaDef, {
            amount:  moneyTransform,
            dueDate: dateTransform,
        })(rest);
        const clash = await rentalPaymentService.findOne(
            {
                lease: leaseId,
                company: company._id,
                dueDate: data.dueDate,
                deletedAt: null,
            },
            {session, logger, languageCode},
        );
        if (clash) {
            throw apiValidationException("rental_payment_duplicate_due", "", null, languageCode);
        }
        data.unit = leaseUnitId;
        data.status = RentalPaymentStatus.PENDING;
        if (fileIds?.length > 0) data.receiptMedia = new ObjectId(fileIds[0]);
        return data;
    },
    buildUpdateData: async ({fileIds, existing, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(RentalPaymentSchemaDef, {
            amount:  moneyTransform,
            dueDate: dateTransform,
        })(params, writeFields);
        delete data.status;
        delete data.paidAmount;
        if (existing && (hasCollectedCash(existing) || existing.status !== RentalPaymentStatus.PENDING)) {
            if (data.amount != null || data.dueDate != null) {
                throw apiValidationException("rental_payment_amount_locked", "", null, params.languageCode);
            }
            delete data.amount;
            delete data.dueDate;
        }
        if (fileIds?.length > 0 && writeFields.receiptMedia) {
            data.receiptMedia = new ObjectId(fileIds[0]);
        }
        return data;
    },
});
