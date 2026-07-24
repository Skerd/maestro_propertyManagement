import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {IncomingInvoiceSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/incomingInvoice.schema-def";
import {createIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/createIncomingInvoice.form.validator";
import {editIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/editIncomingInvoice.form.validator";
import IncomingInvoice from "../../../database/schemas/incomingInvoice/incomingInvoice";
import {incomingInvoiceService} from "../../../database/schemas/incomingInvoice/incomingInvoice.service";
import {IncomingInvoiceActions} from "../../../database/schemas/incomingInvoice/incomingInvoice.actions";
import {incomingInvoiceToDTO, incomingInvoicesToDTO} from "../../../utilities/mappers/incomingInvoice/incomingInvoiceMapper.dto";
import {incomingInvoicesToSelect} from "../../../utilities/mappers/incomingInvoice/incomingInvoiceMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    extractedInvoiceDate: (v) => new Date(v as string),
    extractedDueDate: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "incominginvoices",
    model: IncomingInvoice,
    service: incomingInvoiceService,
    entityName: "IncomingInvoice",
    createSchema: createIncomingInvoiceFormSchema,
    editSchema: editIncomingInvoiceFormSchema,
    toDTO: incomingInvoiceToDTO,
    toDTOArray: incomingInvoicesToDTO,
    toSelect: incomingInvoicesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",

    actions: IncomingInvoiceActions,
    extraListFilter: async ({status, ocrStatus}: any) => {
        const filter: Record<string, any> = {};
        if (status && status !== "") filter.status = status;
        if (ocrStatus && ocrStatus !== "") filter.ocrStatus = ocrStatus;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(IncomingInvoiceSchemaDef, transforms)(params);
        data.status = "inbox";
        data.ocrStatus = "pending";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(IncomingInvoiceSchemaDef, transforms)({...params, media}, writeFields);
        return data;
    },
});
