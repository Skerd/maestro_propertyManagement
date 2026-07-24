import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {WarrantySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/warranty.schema-def";
import {createWarrantyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/createWarranty.form.validator";
import {editWarrantyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/warranty/editWarranty.form.validator";
import Warranty from "../../../database/schemas/warranty/warranty";
import {warrantyService} from "../../../database/schemas/warranty/warranty.service";
import {WarrantyActions} from "../../../database/schemas/warranty/warranty.actions";
import {warrantyToDTO, warrantysToDTO} from "../../../utilities/mappers/warranty/warrantyMapper.dto";
import {warrantysToSelect} from "../../../utilities/mappers/warranty/warrantyMapper.select";

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
    retentionAmount: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
};

export const {router} = createCrudRouter({
    collectionName: "warranties",
    model: Warranty,
    service: warrantyService,
    entityName: "Warranty",
    createSchema: createWarrantyFormSchema,
    editSchema: editWarrantyFormSchema,
    toDTO: warrantyToDTO,
    toDTOArray: warrantysToDTO,
    toSelect: warrantysToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: WarrantyActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(WarrantySchemaDef, transforms)(params);
        data.status = "active";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(WarrantySchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
