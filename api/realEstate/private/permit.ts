import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {PermitSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/permit.schema-def";
import {createPermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/createPermit.form.validator";
import {editPermitFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/permit/editPermit.form.validator";
import Permit from "../../../database/schemas/permit/permit";
import {permitService} from "../../../database/schemas/permit/permit.service";
import {PermitActions} from "../../../database/schemas/permit/permit.actions";
import {permitToDTO, permitsToDTO} from "../../../utilities/mappers/permit/permitMapper.dto";
import {permitsToSelect} from "../../../utilities/mappers/permit/permitMapper.select";

const uploadMW      = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});
const dateTransform = (v: unknown) => new Date(v as string);

function mergeMediaIds(kept: unknown, fileIds?: string[]) {
    const keptIds = Array.isArray(kept)
        ? kept.filter((id): id is string => typeof id === "string" && id.trim() !== "")
        : [];
    const uploaded = fileIds?.map((id) => new ObjectId(id)) ?? [];
    return [...keptIds.map((id) => new ObjectId(id)), ...uploaded];
}

export const {router} = createCrudRouter({
    collectionName: "permits",
    model:          Permit,
    service:        permitService,
    entityName:     "Permit",
    createSchema:   createPermitFormSchema,
    editSchema:     editPermitFormSchema,
    toDTO:          permitToDTO,
    toDTOArray:     permitsToDTO,
    toSelect:       permitsToSelect,
    defaultSort:    {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    actions:        PermitActions,
    extraListFilter: async ({projectId, edificeId, status, permitType}: any) => {
        const filter: Record<string, any> = {};
        if (projectId   && projectId   !== "") filter.project     = new ObjectId(String(projectId));
        if (edificeId   && edificeId   !== "") filter.edifice     = new ObjectId(String(edificeId));
        if (status      && status      !== "") filter.status      = status;
        if (permitType  && permitType  !== "") filter.permitType  = permitType;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(PermitSchemaDef, {
            submittedAt: dateTransform,
            approvedAt:  dateTransform,
            expiresAt:   dateTransform,
        })(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },

    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(PermitSchemaDef, {
            submittedAt: dateTransform,
            approvedAt:  dateTransform,
            expiresAt:   dateTransform,
        })({...params, media}, writeFields);

        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            data.media = mergeMediaIds(media, fileIds);
        }

        return data;
    },
});
