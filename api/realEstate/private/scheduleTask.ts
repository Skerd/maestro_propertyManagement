import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {ScheduleTaskSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/scheduleTask.schema-def";
import {createScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/createScheduleTask.form.validator";
import {editScheduleTaskFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/scheduleTask/editScheduleTask.form.validator";
import ScheduleTask from "../../../database/schemas/scheduleTask/scheduleTask";
import {scheduleTaskService} from "../../../database/schemas/scheduleTask/scheduleTask.service";
import {ScheduleTaskActions} from "../../../database/schemas/scheduleTask/scheduleTask.actions";
import {scheduleTaskToDTO, scheduleTasksToDTO} from "../../../utilities/mappers/scheduleTask/scheduleTaskMapper.dto";
import {scheduleTasksToSelect} from "../../../utilities/mappers/scheduleTask/scheduleTaskMapper.select";

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
    collectionName: "scheduletasks",
    model:          ScheduleTask,
    service:        scheduleTaskService,
    entityName:     "ScheduleTask",
    createSchema:   createScheduleTaskFormSchema,
    editSchema:     editScheduleTaskFormSchema,
    toDTO:          scheduleTaskToDTO,
    toDTOArray:     scheduleTasksToDTO,
    toSelect:       scheduleTasksToSelect,
    defaultSort:    {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    actions:        ScheduleTaskActions,
    extraListFilter: async ({projectId, edificeId, milestoneId, assigneeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId   && projectId   !== "") filter.project   = new ObjectId(String(projectId));
        if (edificeId   && edificeId   !== "") filter.edifice   = new ObjectId(String(edificeId));
        if (milestoneId && milestoneId !== "") filter.milestone = new ObjectId(String(milestoneId));
        if (assigneeId  && assigneeId  !== "") filter.assignee  = new ObjectId(String(assigneeId));
        if (status      && status      !== "") filter.status    = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(ScheduleTaskSchemaDef, {
            plannedStart: dateTransform,
            plannedEnd:   dateTransform,
        })(params);
        data.status = "planned";
        if (fileIds?.length > 0) data.media = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(ScheduleTaskSchemaDef, {
            plannedStart: dateTransform,
            plannedEnd:   dateTransform,
        })({...params, media}, writeFields);

        if (writeFields.media && (media !== undefined || fileIds?.length > 0)) {
            data.media = mergeMediaIds(media, fileIds);
        }

        return data;
    },
});
