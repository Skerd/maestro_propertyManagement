import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {SnagSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.schema-def";
import {createSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/createSnag.form.validator";
import {editSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/editSnag.form.validator";
import Snag from "../../../database/schemas/snag/snag";
import {snagService} from "../../../database/schemas/snag/snag.service";
import {SnagActions} from "../../../database/schemas/snag/snag.actions";
import {snagToDTO, snagsToDTO} from "../../../utilities/mappers/snag/snagMapper.dto";
import {snagsToSelect} from "../../../utilities/mappers/snag/snagMapper.select";

const uploadMW      = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});
const dateTransform = (v: unknown) => new Date(v as string);

function mergePhotoIds(kept: unknown, fileIds?: string[]) {
    const keptIds = Array.isArray(kept)
        ? kept.filter((id): id is string => typeof id === "string" && id.trim() !== "")
        : [];
    const uploaded = fileIds?.map((id) => new ObjectId(id)) ?? [];
    return [...keptIds.map((id) => new ObjectId(id)), ...uploaded];
}

export const {router} = createCrudRouter({
    collectionName: "snags",
    model:          Snag,
    service:        snagService,
    entityName:     "Snag",
    createSchema:   createSnagFormSchema,
    editSchema:     editSnagFormSchema,
    toDTO:          snagToDTO,
    toDTOArray:     snagsToDTO,
    toSelect:       snagsToSelect,
    defaultSort:    {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    actions:        SnagActions,
    extraListFilter: async ({unitId, status, severity}: any) => {
        const filter: Record<string, any> = {};
        if (unitId   && unitId   !== "") filter.unit     = new ObjectId(String(unitId));
        if (status   && status   !== "") filter.status   = status;
        if (severity && severity !== "") filter.severity = severity;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(SnagSchemaDef, {
            dueDate: dateTransform,
        })(params);
        data.status = "open";
        if (fileIds?.length > 0) data.photos = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },

    buildUpdateData: async ({fileIds, photos, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(SnagSchemaDef, {
            dueDate: dateTransform,
        })({...params, photos}, writeFields);

        if (writeFields.photos && (photos !== undefined || fileIds?.length > 0)) {
            data.photos = mergePhotoIds(photos, fileIds);
        }

        return data;
    },
});
