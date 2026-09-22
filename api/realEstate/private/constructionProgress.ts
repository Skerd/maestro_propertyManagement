import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {ConstructionProgressSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.schema-def";
import {createConstructionProgressFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/createConstructionProgress.form.validator";
import {editConstructionProgressFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/editConstructionProgress.form.validator";
import {validateTableForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import ConstructionProgress, {type IConstructionProgress} from "../../../database/schemas/constructionProgress/constructionProgress";
import {constructionProgressService} from "../../../database/schemas/constructionProgress/constructionProgress.service";
import {ConstructionProgressActions} from "../../../database/schemas/constructionProgress/constructionProgress.actions";
import Edifice from "../../../database/schemas/edifice/edifice";
import {constructionProgressToDTO, constructionProgressesToDTO} from "../../../utilities/mappers/constructionProgress/constructionProgressMapper.dto";
import {constructionProgressesToSelect} from "../../../utilities/mappers/constructionProgress/constructionProgressMapper.select";
import {findLatestConstructionProgress, isConstructionAdvance} from "../../../utilities/constructionProgress/constructionProgressAdvance";
import {notifyConstructionProgressClients} from "../../../utilities/constructionProgress/notifyConstructionProgressClients";
import {afterCommit} from "../../../utilities/sale/salesStaffNotify";

const uploadMW = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});
const dateTransform = (v: unknown) => new Date(v as string);
const optionalDateTransform = (v: unknown) => (v ? new Date(v as string) : undefined);

function mergePhotoIds(kept: unknown, fileIds?: string[]) {
    const keptIds = Array.isArray(kept)
        ? kept.filter((id): id is string => typeof id === "string" && id.trim() !== "")
        : [];
    const uploaded = fileIds?.map((id) => new ObjectId(id)) ?? [];
    return [...keptIds.map((id) => new ObjectId(id)), ...uploaded];
}

const validId = (v: unknown) => v != null && v !== "" && ObjectId.isValid(String(v));

/** The optional building must belong to the report's project. */
async function assertEdificeInProject(params: any, project: unknown, edifice: unknown): Promise<void> {
    if (!validId(edifice)) return;
    const found = await Edifice.findOne({
        _id: new ObjectId(String(edifice)),
        project: new ObjectId(String(project)),
        company: params.company._id,
    }).select("_id").session(params.session ?? null);
    if (!found) throw apiValidationException("edifice_not_found", "", null, params.languageCode);
}

export const {router} = createCrudRouter({
    collectionName: "constructionprogresses",
    model:          ConstructionProgress,
    service:        constructionProgressService,
    entityName:     "ConstructionProgress",
    actions:        ConstructionProgressActions,
    listSchema:     validateTableForm, // project / edifice / phase filter via the generic `filter` DSL
    createSchema:   createConstructionProgressFormSchema,
    editSchema:     editConstructionProgressFormSchema,
    toDTO:          constructionProgressToDTO,
    toDTOArray:     constructionProgressesToDTO,
    toSelect:       constructionProgressesToSelect,
    defaultSort:    {updateDate: -1, createdAt: -1},
    selectSort:     {updateDate: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW],
    editMiddleware:   [uploadMW],
    buildCreateData: async (params: any) => {
        const {fileIds, ...rest} = params;
        await assertEdificeInProject(params, rest.project, rest.edifice);
        const data = buildCreateDataFromSchemaDef(ConstructionProgressSchemaDef, {
            updateDate: dateTransform,
            expectedCompletionDate: optionalDateTransform,
        })(rest);
        if (!validId(rest.edifice)) delete data.edifice;
        if (fileIds?.length > 0) data.photos = fileIds.map((id: string) => new ObjectId(id));
        return data;
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {fileIds, photos, ...rest} = params;
        if (rest.project !== undefined || rest.edifice !== undefined) {
            const current = await ConstructionProgress.findById(rest._id).select("project").session(params.session ?? null);
            await assertEdificeInProject(params, rest.project ?? current?.project, rest.edifice);
        }
        const data = buildUpdateDataFromSchemaDef(ConstructionProgressSchemaDef, {
            updateDate: dateTransform,
            expectedCompletionDate: optionalDateTransform,
        })({...rest, photos}, writeFields);

        if (writeFields.photos && (photos !== undefined || fileIds?.length > 0)) {
            data.photos = mergePhotoIds(photos, fileIds);
        }

        return data;
    },
    afterCreate: async (created, params: any) => {
        const {session, company, languageCode} = params;
        const report = created as IConstructionProgress;

        // Notify only when this report moves the scope forward compared with the previous latest one.
        const previous = await findLatestConstructionProgress(
            {company: company._id, project: report.project as unknown as ObjectId, edifice: report.edifice as unknown as ObjectId | undefined},
            {session, excludeId: report._id as ObjectId},
        );

        if (report.notifyClients !== false && isConstructionAdvance(previous, report)) {
            const id = report._id as ObjectId;
            afterCommit(session, () => notifyConstructionProgressClients(id, {languageCode: languageCode ?? "en-US"}));
        }
    },
});
