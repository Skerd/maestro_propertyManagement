import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {ApprovalWorkflowSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalWorkflow/approvalWorkflow.schema-def";
import {createApprovalWorkflowFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalWorkflow/createApprovalWorkflow.form.validator";
import {editApprovalWorkflowFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalWorkflow/editApprovalWorkflow.form.validator";
import ApprovalWorkflow from "../../../database/schemas/approvalWorkflow/approvalWorkflow";
import {approvalWorkflowService} from "../../../database/schemas/approvalWorkflow/approvalWorkflow.service";
import {approvalWorkflowToDTO, approvalWorkflowsToDTO} from "../../../utilities/mappers/approvalWorkflow/approvalWorkflowMapper.dto";
import {approvalWorkflowsToSelect} from "../../../utilities/mappers/approvalWorkflow/approvalWorkflowMapper.select";

export const {router} = createCrudRouter({
    collectionName: "approvalworkflows",
    model: ApprovalWorkflow,
    service: approvalWorkflowService,
    entityName: "ApprovalWorkflow",
    createSchema: createApprovalWorkflowFormSchema,
    editSchema: editApprovalWorkflowFormSchema,
    toDTO: approvalWorkflowToDTO,
    toDTOArray: approvalWorkflowsToDTO,
    toSelect: approvalWorkflowsToSelect,
    defaultSort: {documentType: 1, createdAt: -1},
    selectSearchField: "title",

    extraListFilter: async ({documentType, active}: any) => {
        const filter: Record<string, any> = {};
        if (documentType && documentType !== "") filter.documentType = documentType;
        if (active === "true" || active === true) filter.active = true;
        if (active === "false" || active === false) filter.active = false;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ApprovalWorkflowSchemaDef)(params);
        if (data.active === undefined || data.active === null) data.active = true;
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ApprovalWorkflowSchemaDef)({...params, media}, writeFields);
        return data;
    },
});
