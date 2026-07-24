import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {ApprovalRequestSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/approvalRequest.schema-def";
import {createApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/createApprovalRequest.form.validator";
import {editApprovalRequestFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/editApprovalRequest.form.validator";
import ApprovalRequest from "../../../database/schemas/approvalRequest/approvalRequest";
import {approvalRequestService} from "../../../database/schemas/approvalRequest/approvalRequest.service";
import {ApprovalRequestActions} from "../../../database/schemas/approvalRequest/approvalRequest.actions";
import {approvalRequestToDTO, approvalRequestsToDTO} from "../../../utilities/mappers/approvalRequest/approvalRequestMapper.dto";
import {approvalRequestsToSelect} from "../../../utilities/mappers/approvalRequest/approvalRequestMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    targetId: (v) => new ObjectId(String(v)),
};

export const {router} = createCrudRouter({
    collectionName: "approvalrequests",
    model: ApprovalRequest,
    service: approvalRequestService,
    entityName: "ApprovalRequest",
    createSchema: createApprovalRequestFormSchema,
    editSchema: editApprovalRequestFormSchema,
    toDTO: approvalRequestToDTO,
    toDTOArray: approvalRequestsToDTO,
    toSelect: approvalRequestsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "name",

    actions: ApprovalRequestActions,
    extraListFilter: async ({documentType, status, targetType, targetId}: any) => {
        const filter: Record<string, any> = {};
        if (documentType && documentType !== "") filter.documentType = documentType;
        if (status && status !== "") filter.status = status;
        if (targetType && targetType !== "") filter.targetType = targetType;
        if (targetId && targetId !== "") filter.targetId = new ObjectId(String(targetId));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ApprovalRequestSchemaDef, transforms)(params);
        data.status = "pending";
        data.currentStage = "primary";
        data.primaryDecision = "pending";
        data.escalationDecision = "pending";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ApprovalRequestSchemaDef, transforms)({...params, media}, writeFields);
        return data;
    },
});
