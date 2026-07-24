import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {HandoverPackageSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";
import {createHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/createHandoverPackage.form.validator";
import {editHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/editHandoverPackage.form.validator";
import HandoverPackage from "../../../database/schemas/handoverPackage/handoverPackage";
import {handoverPackageService} from "../../../database/schemas/handoverPackage/handoverPackage.service";
import {HandoverPackageActions} from "../../../database/schemas/handoverPackage/handoverPackage.actions";
import {handoverPackageToDTO, handoverPackagesToDTO} from "../../../utilities/mappers/handoverPackage/handoverPackageMapper.dto";
import {handoverPackagesToSelect} from "../../../utilities/mappers/handoverPackage/handoverPackageMapper.select";

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
    collectionName: "handoverpackages",
    model: HandoverPackage,
    service: handoverPackageService,
    entityName: "HandoverPackage",
    createSchema: createHandoverPackageFormSchema,
    editSchema: editHandoverPackageFormSchema,
    toDTO: handoverPackageToDTO,
    toDTOArray: handoverPackagesToDTO,
    toSelect: handoverPackagesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: HandoverPackageActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(HandoverPackageSchemaDef, transforms)(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(HandoverPackageSchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
