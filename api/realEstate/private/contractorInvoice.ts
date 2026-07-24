import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {ContractorInvoiceSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/contractorInvoice.schema-def";
import {createContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/createContractorInvoice.form.validator";
import {editContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/editContractorInvoice.form.validator";
import ContractorInvoice from "../../../database/schemas/contractorInvoice/contractorInvoice";
import {contractorInvoiceService} from "../../../database/schemas/contractorInvoice/contractorInvoice.service";
import {ContractorInvoiceActions} from "../../../database/schemas/contractorInvoice/contractorInvoice.actions";
import {contractorInvoiceToDTO, contractorInvoicesToDTO} from "../../../utilities/mappers/contractorInvoice/contractorInvoiceMapper.dto";
import {contractorInvoicesToSelect} from "../../../utilities/mappers/contractorInvoice/contractorInvoiceMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    invoiceDate: (v) => new Date(v as string),
    dueDate: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "contractorinvoices",
    model: ContractorInvoice,
    service: contractorInvoiceService,
    entityName: "ContractorInvoice",
    createSchema: createContractorInvoiceFormSchema,
    editSchema: editContractorInvoiceFormSchema,
    toDTO: contractorInvoiceToDTO,
    toDTOArray: contractorInvoicesToDTO,
    toSelect: contractorInvoicesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "invoiceNumber",

    actions: ContractorInvoiceActions,
    extraListFilter: async ({projectId, constructorId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (constructorId && constructorId !== "") filter.constructorRef = new ObjectId(String(constructorId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ContractorInvoiceSchemaDef, transforms)(params);
        data.status = "received";
        if (!data.source) data.source = "manual";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ContractorInvoiceSchemaDef, transforms)({...params, media}, writeFields);
        return data;
    },
});
