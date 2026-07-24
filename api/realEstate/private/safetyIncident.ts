import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {SafetyIncidentSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/safetyIncident.schema-def";
import {createSafetyIncidentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/createSafetyIncident.form.validator";
import {editSafetyIncidentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/safetyIncident/editSafetyIncident.form.validator";
import SafetyIncident from "../../../database/schemas/safetyIncident/safetyIncident";
import {safetyIncidentService} from "../../../database/schemas/safetyIncident/safetyIncident.service";
import {SafetyIncidentActions} from "../../../database/schemas/safetyIncident/safetyIncident.actions";
import {safetyIncidentToDTO, safetyIncidentsToDTO} from "../../../utilities/mappers/safetyIncident/safetyIncidentMapper.dto";
import {safetyIncidentsToSelect} from "../../../utilities/mappers/safetyIncident/safetyIncidentMapper.select";

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
    collectionName: "safetyincidents",
    model: SafetyIncident,
    service: safetyIncidentService,
    entityName: "SafetyIncident",
    createSchema: createSafetyIncidentFormSchema,
    editSchema: editSafetyIncidentFormSchema,
    toDTO: safetyIncidentToDTO,
    toDTOArray: safetyIncidentsToDTO,
    toSelect: safetyIncidentsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: SafetyIncidentActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(SafetyIncidentSchemaDef, transforms)(params);
        data.status = "reported";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(SafetyIncidentSchemaDef, transforms)({...params, media}, writeFields);
        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            const kept = Array.isArray(media) ? media.filter((id: any) => typeof id === "string" && id.trim()) : [];
            data.media = [...kept.map((id: string) => new ObjectId(id)), ...(fileIds || []).map((id: string) => new ObjectId(id))];
        }
        return data;
    },
});
