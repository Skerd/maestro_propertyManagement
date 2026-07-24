import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {CostCommitmentSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/costCommitment.schema-def";
import {createCostCommitmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/createCostCommitment.form.validator";
import {editCostCommitmentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costCommitment/editCostCommitment.form.validator";
import CostCommitment from "../../../database/schemas/costCommitment/costCommitment";
import {costCommitmentService} from "../../../database/schemas/costCommitment/costCommitment.service";
import {CostCommitmentActions} from "../../../database/schemas/costCommitment/costCommitment.actions";
import {costCommitmentToDTO, costCommitmentsToDTO} from "../../../utilities/mappers/costCommitment/costCommitmentMapper.dto";
import {costCommitmentsToSelect} from "../../../utilities/mappers/costCommitment/costCommitmentMapper.select";

const uploadMW = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});

const transforms: Record<string, (v: unknown) => unknown> = {
    issuedAt: (v) => new Date(v as string),
    plannedStart: (v) => new Date(v as string),
    plannedEnd: (v) => new Date(v as string),
    startDate: (v) => new Date(v as string),
    endDate: (v) => new Date(v as string),
    claimPeriodStart: (v) => new Date(v as string),
    claimPeriodEnd: (v) => new Date(v as string),
    dueDate: (v) => new Date(v as string),
    diaryDate: (v) => new Date(v as string),
    incidentDate: (v) => new Date(v as string),
    retentionReleaseDate: (v) => new Date(v as string),
    testDate: (v) => new Date(v as string),
    decidedAt: (v) => new Date(v as string),
    expiresAt: (v) => new Date(v as string),
    committedAmount: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
};

export const {router} = createCrudRouter({
    collectionName: "costcommitments",
    model: CostCommitment,
    service: costCommitmentService,
    entityName: "CostCommitment",
    createSchema: createCostCommitmentFormSchema,
    editSchema: editCostCommitmentFormSchema,
    toDTO: costCommitmentToDTO,
    toDTOArray: costCommitmentsToDTO,
    toSelect: costCommitmentsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: CostCommitmentActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(CostCommitmentSchemaDef, transforms)(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(CostCommitmentSchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
