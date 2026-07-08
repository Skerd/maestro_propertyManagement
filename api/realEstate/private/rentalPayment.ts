import {Decimal128, ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {RentalPaymentSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {createRentalPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/createRentalPayment.form.validator";
import {editRentalPaymentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/editRentalPayment.form.validator";
import RentalPayment, {RentalPaymentStatus} from "../../../database/schemas/rentalPayment/rentalPayment";
import {rentalPaymentService} from "../../../database/schemas/rentalPayment/rentalPayment.service";
import {RentalPaymentActions} from "../../../database/schemas/rentalPayment/rentalPayment.actions";
import {rentalPaymentToDTO, rentalPaymentsToDTO} from "../../../utilities/mappers/rentalPayment/rentalPaymentMapper.dto";
import {rentalPaymentsToSelect} from "../../../utilities/mappers/rentalPayment/rentalPaymentMapper.select";
import {leaseService} from "../../../database/schemas/lease/lease.service";
import {LeaseStatus} from "../../../database/schemas/lease/lease";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";

const uploadMW = mediaUploadMW({maxFiles: 1, maxFileSize: 25 * 1024 * 1024});
const dateTransform  = (v: unknown) => new Date(v as string);
const moneyTransform = (v: unknown) => Decimal128.fromString(String(v));

export const {router} = createCrudRouter({
    collectionName:    "rentalpayments",
    model:             RentalPayment,
    service:           rentalPaymentService,
    entityName:        "RentalPayment",
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
    extraListFilter: async ({leaseId, unitId, status}: any) => {
        const filter: Record<string, any> = {};
        if (leaseId && leaseId !== "") filter.lease = new ObjectId(String(leaseId));
        if (unitId  && unitId  !== "") filter.unit  = new ObjectId(String(unitId));
        if (status  && status  !== "") filter.status = status;
        return filter;
    },
    extraSelectFilter: async ({leaseId}: any) => leaseId && leaseId !== ""
        ? {lease: new ObjectId(String(leaseId))}
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
            amount:     moneyTransform,
            paidAmount: moneyTransform,
            dueDate:    dateTransform,
        })(rest);
        data.unit = leaseUnitId;
        data.status = RentalPaymentStatus.PENDING;
        if (fileIds?.length > 0) data.receiptMedia = new ObjectId(fileIds[0]);
        return data;
    },
    buildUpdateData: async ({fileIds, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(RentalPaymentSchemaDef, {
            amount:     moneyTransform,
            paidAmount: moneyTransform,
            dueDate:    dateTransform,
        })(params, writeFields);
        delete data.status;
        if (fileIds?.length > 0 && writeFields.receiptMedia) {
            data.receiptMedia = new ObjectId(fileIds[0]);
        }
        return data;
    },
});
