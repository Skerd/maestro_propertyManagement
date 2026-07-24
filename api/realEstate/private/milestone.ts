import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {MilestoneSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/milestone.schema-def";
import {createMilestoneFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/createMilestone.form.validator";
import {editMilestoneFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/milestone/editMilestone.form.validator";
import Milestone from "../../../database/schemas/milestone/milestone";
import {milestoneService} from "../../../database/schemas/milestone/milestone.service";
import {MilestoneActions} from "../../../database/schemas/milestone/milestone.actions";
import {milestoneToDTO, milestonesToDTO} from "../../../utilities/mappers/milestone/milestoneMapper.dto";
import {milestonesToSelect} from "../../../utilities/mappers/milestone/milestoneMapper.select";

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
    collectionName: "milestones",
    model:          Milestone,
    service:        milestoneService,
    entityName:     "Milestone",
    createSchema:   createMilestoneFormSchema,
    editSchema:     editMilestoneFormSchema,
    toDTO:          milestoneToDTO,
    toDTOArray:     milestonesToDTO,
    toSelect:       milestonesToSelect,
    defaultSort:    {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    actions:        MilestoneActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status    && status    !== "") filter.status  = status;
        return filter;
    },
    extraSelectFilter: async ({projectId, project, notId}: any) => {
        const filter: Record<string, any> = {};
        const projectFilter = projectId ?? project;
        if (projectFilter && projectFilter !== "") filter.project = new ObjectId(String(projectFilter));
        if (notId && notId !== "") filter._id = {$ne: new ObjectId(String(notId))};
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(MilestoneSchemaDef, {
            plannedStart: dateTransform,
            plannedEnd:   dateTransform,
        })(params);
        data.status = "planned";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(MilestoneSchemaDef, {
            plannedStart: dateTransform,
            plannedEnd:   dateTransform,
        })({...params, media}, writeFields);

        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            data.media = mergeMediaIds(media, fileIds);
        }

        return data;
    },
});
