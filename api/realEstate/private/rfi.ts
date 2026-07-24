import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {RfiSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/rfi.schema-def";
import {createRfiFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/createRfi.form.validator";
import {editRfiFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/rfi/editRfi.form.validator";
import Rfi from "../../../database/schemas/rfi/rfi";
import {rfiService} from "../../../database/schemas/rfi/rfi.service";
import {RfiActions} from "../../../database/schemas/rfi/rfi.actions";
import {rfiToDTO, rfisToDTO} from "../../../utilities/mappers/rfi/rfiMapper.dto";
import {rfisToSelect} from "../../../utilities/mappers/rfi/rfiMapper.select";

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
    collectionName: "rfis",
    model: Rfi,
    service: rfiService,
    entityName: "Rfi",
    createSchema: createRfiFormSchema,
    editSchema: editRfiFormSchema,
    toDTO: rfiToDTO,
    toDTOArray: rfisToDTO,
    toSelect: rfisToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: RfiActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(RfiSchemaDef, transforms)(params);
        data.status = "open";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(RfiSchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
