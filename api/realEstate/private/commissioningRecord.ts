import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {CommissioningRecordSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/commissioningRecord/commissioningRecord.schema-def";
import {createCommissioningRecordFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commissioningRecord/createCommissioningRecord.form.validator";
import {editCommissioningRecordFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commissioningRecord/editCommissioningRecord.form.validator";
import CommissioningRecord from "../../../database/schemas/commissioningRecord/commissioningRecord";
import {commissioningRecordService} from "../../../database/schemas/commissioningRecord/commissioningRecord.service";
import {CommissioningRecordActions} from "../../../database/schemas/commissioningRecord/commissioningRecord.actions";
import {commissioningRecordToDTO, commissioningRecordsToDTO} from "../../../utilities/mappers/commissioningRecord/commissioningRecordMapper.dto";
import {commissioningRecordsToSelect} from "../../../utilities/mappers/commissioningRecord/commissioningRecordMapper.select";

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
};

export const {router} = createCrudRouter({
    collectionName: "commissioningrecords",
    model: CommissioningRecord,
    service: commissioningRecordService,
    entityName: "CommissioningRecord",
    createSchema: createCommissioningRecordFormSchema,
    editSchema: editCommissioningRecordFormSchema,
    toDTO: commissioningRecordToDTO,
    toDTOArray: commissioningRecordsToDTO,
    toSelect: commissioningRecordsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: CommissioningRecordActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(CommissioningRecordSchemaDef, transforms)(params);
        data.status = "pending";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(CommissioningRecordSchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
