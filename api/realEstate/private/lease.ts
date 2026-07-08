import {Decimal128, ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {LeaseSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.schema-def";
import {createLeaseFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/createLease.form.validator";
import {editLeaseFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/editLease.form.validator";
import Lease, {LeaseStatus} from "../../../database/schemas/lease/lease";
import {leaseService} from "../../../database/schemas/lease/lease.service";
import {LeaseActions} from "../../../database/schemas/lease/lease.actions";
import {leaseToDTO, leasesToDTO} from "../../../utilities/mappers/lease/leaseMapper.dto";
import {leasesToSelect} from "../../../utilities/mappers/lease/leaseMapper.select";
import {rentalPaymentService} from "../../../database/schemas/rentalPayment/rentalPayment.service";
import {RentalPaymentStatus} from "../../../database/schemas/rentalPayment/rentalPayment";
import {buildMonthlyRentDueDates} from "../../../utilities/lease/rentalPaymentSchedule";
import {
    assertUnitRentable,
    markUnitRented,
    releaseUnitIfRented,
    unitIdFromLease,
    waiveOpenRentalPayments,
} from "../../../utilities/lease/leaseLifecycle";

const uploadMW = mediaUploadMW({maxFiles: 1, maxFileSize: 25 * 1024 * 1024});

const dateTransform  = (v: unknown) => new Date(v as string);
const moneyTransform = (v: unknown) => Decimal128.fromString(String(v));

export const {router} = createCrudRouter({
    collectionName:   "leases",
    model:            Lease,
    service:          leaseService,
    entityName:       "Lease",
    createSchema:     createLeaseFormSchema,
    editSchema:       editLeaseFormSchema,
    toDTO:            leaseToDTO,
    toDTOArray:       leasesToDTO,
    toSelect:         leasesToSelect,
    defaultSort:      {createdAt: -1},
    selectSearchField: "name",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    actions:          LeaseActions,
    extraListFilter: async ({unitId, status, tenantId}: any) => {
        const filter: Record<string, any> = {};
        if (unitId   && unitId   !== "") filter.unit   = new ObjectId(String(unitId));
        if (tenantId && tenantId !== "") filter.tenant = new ObjectId(String(tenantId));
        if (status   && status   !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async (params: any) => {
        const {fileIds, session, logger, languageCode, actionUserCtx, company, ...rest} = params;
        const unitId = new ObjectId(String(rest.unit));
        await assertUnitRentable(unitId, {session, logger, languageCode, actionUserCtx, company});

        const startDate = dateTransform(rest.startDate);
        const endDate = dateTransform(rest.endDate);
        if (startDate.getTime() > endDate.getTime()) {
            throw apiValidationException("lease_invalid_date_range", "", null, languageCode);
        }

        const data = buildCreateDataFromSchemaDef(LeaseSchemaDef, {
            monthlyRent:   moneyTransform,
            depositAmount: moneyTransform,
            startDate:     dateTransform,
            endDate:       dateTransform,
        })(rest);
        data.status = LeaseStatus.ACTIVE;
        if (fileIds?.length > 0) data.contractMedia = new ObjectId(fileIds[0]);
        return data;
    },
    buildUpdateData: async ({fileIds, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(LeaseSchemaDef, {
            monthlyRent:   moneyTransform,
            depositAmount: moneyTransform,
            startDate:     dateTransform,
            endDate:       dateTransform,
        })(params, writeFields);
        // status is action-only
        delete data.status;
        if (fileIds?.length > 0 && writeFields.contractMedia) {
            data.contractMedia = new ObjectId(fileIds[0]);
        }
        return data;
    },
    afterCreate: async (created, params) => {
        const {session, logger, languageCode, actionUserCtx, company} = params;
        const ctx = {session, logger, languageCode, actionUserCtx, company};
        const unitId = unitIdFromLease(created);
        if (unitId) await markUnitRented(unitId, ctx);

        const startDate = created.startDate instanceof Date ? created.startDate : new Date(created.startDate);
        const endDate = created.endDate instanceof Date ? created.endDate : new Date(created.endDate);
        const dueDates = buildMonthlyRentDueDates(startDate, endDate);
        const amount = created.monthlyRent;
        const currency = (created.rentCurrency as any)?._id ?? created.rentCurrency;
        const leaseUnit = (created.unit as any)?._id ?? created.unit;

        if (dueDates.length > 0 && amount != null && currency && leaseUnit) {
            const rows = dueDates.map((dueDate) => ({
                lease:    created._id,
                unit:     leaseUnit,
                dueDate,
                amount,
                currency,
                status:   RentalPaymentStatus.PENDING,
                company:  company._id,
            }));
            await rentalPaymentService.createMany(rows as any, {
                session,
                logger,
                languageCode,
                auditUserId: actionUserCtx.userId,
            });
        }
    },
    afterDelete: async (params, doc) => {
        const {session, logger, languageCode, actionUserCtx, company} = params;
        const ctx = {session, logger, languageCode, actionUserCtx, company};
        await waiveOpenRentalPayments(doc._id, ctx);
        const unitId = unitIdFromLease(doc);
        if (unitId) await releaseUnitIfRented(unitId, ctx);
    },
});
