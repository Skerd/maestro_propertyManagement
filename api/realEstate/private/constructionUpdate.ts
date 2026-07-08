import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {ConstructionUpdateSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/constructionUpdate.schema-def";
import {createConstructionUpdateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/createConstructionUpdate.form.validator";
import {editConstructionUpdateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/editConstructionUpdate.form.validator";
import ConstructionUpdate from "../../../database/schemas/constructionUpdate/constructionUpdate";
import {constructionUpdateService} from "../../../database/schemas/constructionUpdate/constructionUpdate.service";
import {constructionUpdateToDTO, constructionUpdatesToDTO} from "../../../utilities/mappers/constructionUpdate/constructionUpdateMapper.dto";
import {constructionUpdatesToSelect} from "../../../utilities/mappers/constructionUpdate/constructionUpdateMapper.select";

const uploadMW = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});
const dateTransform = (v: unknown) => new Date(v as string);

function mergePhotoIds(kept: unknown, fileIds?: string[]) {
    const keptIds = Array.isArray(kept)
        ? kept.filter((id): id is string => typeof id === "string" && id.trim() !== "")
        : [];
    const uploaded = fileIds?.map((id) => new ObjectId(id)) ?? [];
    return [...keptIds.map((id) => new ObjectId(id)), ...uploaded];
}

export const {router} = createCrudRouter({
    collectionName: "constructionupdates",
    model:          ConstructionUpdate,
    service:        constructionUpdateService,
    entityName:     "ConstructionUpdate",
    createSchema:   createConstructionUpdateFormSchema,
    editSchema:     editConstructionUpdateFormSchema,
    toDTO:          constructionUpdateToDTO,
    toDTOArray:     constructionUpdatesToDTO,
    toSelect:       constructionUpdatesToSelect,
    defaultSort:    {updateDate: -1},
    selectSort:     {updateDate: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    extraListFilter: async ({projectId, edificeId}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ConstructionUpdateSchemaDef, {
            updateDate: dateTransform,
        })(params);
        if (fileIds?.length > 0) data.photos = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, photos, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ConstructionUpdateSchemaDef, {
            updateDate: dateTransform,
        })({...params, photos}, writeFields);

        if (writeFields.photos && (photos !== undefined || fileIds?.length > 0)) {
            data.photos = mergePhotoIds(photos, fileIds);
        }

        return data;
    },
});
