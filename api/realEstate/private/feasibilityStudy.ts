import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {FeasibilityStudySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/feasibilityStudy.schema-def";
import {createFeasibilityStudyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/createFeasibilityStudy.form.validator";
import {editFeasibilityStudyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feasibilityStudy/editFeasibilityStudy.form.validator";
import FeasibilityStudy from "../../../database/schemas/feasibilityStudy/feasibilityStudy";
import {feasibilityStudyService} from "../../../database/schemas/feasibilityStudy/feasibilityStudy.service";
import {FeasibilityStudyActions} from "../../../database/schemas/feasibilityStudy/feasibilityStudy.actions";
import {feasibilityStudyToDTO, feasibilityStudysToDTO} from "../../../utilities/mappers/feasibilityStudy/feasibilityStudyMapper.dto";
import {feasibilityStudysToSelect} from "../../../utilities/mappers/feasibilityStudy/feasibilityStudyMapper.select";

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
    softCostEstimate: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
    hardCostEstimate: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
    residualValue: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
};

export const {router} = createCrudRouter({
    collectionName: "feasibilitystudies",
    model: FeasibilityStudy,
    service: feasibilityStudyService,
    entityName: "FeasibilityStudy",
    createSchema: createFeasibilityStudyFormSchema,
    editSchema: editFeasibilityStudyFormSchema,
    toDTO: feasibilityStudyToDTO,
    toDTOArray: feasibilityStudysToDTO,
    toSelect: feasibilityStudysToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: FeasibilityStudyActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(FeasibilityStudySchemaDef, transforms)(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(FeasibilityStudySchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
