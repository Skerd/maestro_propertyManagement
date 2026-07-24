import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {SiteDiarySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/siteDiary/siteDiary.schema-def";
import {createSiteDiaryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/siteDiary/createSiteDiary.form.validator";
import {editSiteDiaryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/siteDiary/editSiteDiary.form.validator";
import SiteDiary from "../../../database/schemas/siteDiary/siteDiary";
import {siteDiaryService} from "../../../database/schemas/siteDiary/siteDiary.service";
import {SiteDiaryActions} from "../../../database/schemas/siteDiary/siteDiary.actions";
import {siteDiaryToDTO, siteDiarysToDTO} from "../../../utilities/mappers/siteDiary/siteDiaryMapper.dto";
import {siteDiarysToSelect} from "../../../utilities/mappers/siteDiary/siteDiaryMapper.select";

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
    collectionName: "sitediaries",
    model: SiteDiary,
    service: siteDiaryService,
    entityName: "SiteDiary",
    createSchema: createSiteDiaryFormSchema,
    editSchema: editSiteDiaryFormSchema,
    toDTO: siteDiaryToDTO,
    toDTOArray: siteDiarysToDTO,
    toSelect: siteDiarysToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: SiteDiaryActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(SiteDiarySchemaDef, transforms)(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(SiteDiarySchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
