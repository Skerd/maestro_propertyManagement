import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {ProjectDocumentSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/projectDocument.schema-def";
import {createProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/createProjectDocument.form.validator";
import {editProjectDocumentFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/projectDocument/editProjectDocument.form.validator";
import ProjectDocument from "../../../database/schemas/projectDocument/projectDocument";
import {projectDocumentService} from "../../../database/schemas/projectDocument/projectDocument.service";
import {ProjectDocumentActions} from "../../../database/schemas/projectDocument/projectDocument.actions";
import {projectDocumentToDTO, projectDocumentsToDTO} from "../../../utilities/mappers/projectDocument/projectDocumentMapper.dto";
import {projectDocumentsToSelect} from "../../../utilities/mappers/projectDocument/projectDocumentMapper.select";

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
    collectionName: "projectdocuments",
    model:          ProjectDocument,
    service:        projectDocumentService,
    entityName:     "ProjectDocument",
    createSchema:   createProjectDocumentFormSchema,
    editSchema:     editProjectDocumentFormSchema,
    toDTO:          projectDocumentToDTO,
    toDTOArray:     projectDocumentsToDTO,
    toSelect:       projectDocumentsToSelect,
    defaultSort:    {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    actions:        ProjectDocumentActions,
    extraListFilter: async ({projectId, edificeId, floorId, unitId, status, discipline, documentType}: any) => {
        const filter: Record<string, any> = {};
        if (projectId     && projectId     !== "") filter.project      = new ObjectId(String(projectId));
        if (edificeId     && edificeId     !== "") filter.edifice      = new ObjectId(String(edificeId));
        if (floorId       && floorId       !== "") filter.floor        = new ObjectId(String(floorId));
        if (unitId        && unitId        !== "") filter.unit         = new ObjectId(String(unitId));
        if (status        && status        !== "") filter.status       = status;
        if (discipline    && discipline    !== "") filter.discipline   = discipline;
        if (documentType  && documentType  !== "") filter.documentType = documentType;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ProjectDocumentSchemaDef, {
            revisionDate: dateTransform,
        })(params);
        data.status = "draft";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },

    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ProjectDocumentSchemaDef, {
            revisionDate: dateTransform,
        })({...params, media}, writeFields);

        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            data.media = mergeMediaIds(media, fileIds);
        }

        return data;
    },
});
