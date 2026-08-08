import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {ConstructionContractSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/constructionContract.schema-def";
import {createConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/createConstructionContract.form.validator";
import {editConstructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/editConstructionContract.form.validator";
import {constructionContractFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionContract/constructionContract.form.validator";
import ConstructionContract from "../../../database/schemas/constructionContract/constructionContract";
import {constructionContractService} from "../../../database/schemas/constructionContract/constructionContract.service";
import {ConstructionContractActions} from "../../../database/schemas/constructionContract/constructionContract.actions";
import {constructionContractToDTO, constructionContractsToDTO} from "../../../utilities/mappers/constructionContract/constructionContractMapper.dto";
import {constructionContractsToSelect} from "../../../utilities/mappers/constructionContract/constructionContractMapper.select";

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
    contractValue: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
    performanceBond: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
};

async function constructionContractExtraListFilter(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {project, edifice, status} = params as {
        project?: string;
        edifice?: string;
        status?: string;
    };
    const filter: Record<string, unknown> = {};
    if (project && ObjectId.isValid(String(project))) filter.project = new ObjectId(String(project));
    if (edifice && ObjectId.isValid(String(edifice))) filter.edifice = new ObjectId(String(edifice));
    if (status && status !== "") filter.status = status;
    return filter;
}

export const {router} = createCrudRouter({
    collectionName: "constructioncontracts",
    model: ConstructionContract,
    service: constructionContractService,
    entityName: "ConstructionContract",
    listSchema: constructionContractFormSchema,
    extraListFilter: constructionContractExtraListFilter,
    createSchema: createConstructionContractFormSchema,
    editSchema: editConstructionContractFormSchema,
    toDTO: constructionContractToDTO,
    toDTOArray: constructionContractsToDTO,
    toSelect: constructionContractsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: ConstructionContractActions,
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ConstructionContractSchemaDef, transforms)(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ConstructionContractSchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
