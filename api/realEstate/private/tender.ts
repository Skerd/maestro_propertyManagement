import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {TenderSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/tender.schema-def";
import {createTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/createTender.form.validator";
import {editTenderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tender/editTender.form.validator";
import Tender from "../../../database/schemas/tender/tender";
import {tenderService} from "../../../database/schemas/tender/tender.service";
import {TenderActions} from "../../../database/schemas/tender/tender.actions";
import {tenderToDTO, tendersToDTO} from "../../../utilities/mappers/tender/tenderMapper.dto";
import {tendersToSelect} from "../../../utilities/mappers/tender/tenderMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    submissionDeadline: (v) => new Date(v as string),
    openingDate: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "tenders",
    model: Tender,
    service: tenderService,
    entityName: "Tender",
    createSchema: createTenderFormSchema,
    editSchema: editTenderFormSchema,
    toDTO: tenderToDTO,
    toDTOArray: tendersToDTO,
    toSelect: tendersToSelect,
    defaultSort: {submissionDeadline: 1, createdAt: -1},
    selectSearchField: "title",

    actions: TenderActions,
    extraListFilter: async ({projectId, specificationId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (specificationId && specificationId !== "") filter.specification = new ObjectId(String(specificationId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(TenderSchemaDef, transforms)(params);
        data.status = "draft";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(TenderSchemaDef, transforms)({...params, media}, writeFields);
        return data;
    },
});
