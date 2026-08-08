import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {SnagSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.schema-def";
import {createSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/createSnag.form.validator";
import {editSnagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/editSnag.form.validator";
import {snagFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.form.validator";
import Snag from "../../../database/schemas/snag/snag";
import {snagService} from "../../../database/schemas/snag/snag.service";
import {SnagActions} from "../../../database/schemas/snag/snag.actions";
import {snagToDTO, snagsToDTO} from "../../../utilities/mappers/snag/snagMapper.dto";
import {snagsToSelect} from "../../../utilities/mappers/snag/snagMapper.select";
import {unitService} from "../../../database/schemas/unit/unit.service";

const uploadMW      = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});
const dateTransform = (v: unknown) => new Date(v as string);

function mergePhotoIds(kept: unknown, fileIds?: string[]) {
    const keptIds = Array.isArray(kept)
        ? kept.filter((id): id is string => typeof id === "string" && id.trim() !== "")
        : [];
    const uploaded = fileIds?.map((id) => new ObjectId(id)) ?? [];
    return [...keptIds.map((id) => new ObjectId(id)), ...uploaded];
}

async function snagExtraListFilter(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {unit, project, edifice, floor, company, logger, languageCode} = params as {
        unit?: string;
        project?: string;
        edifice?: string;
        floor?: string;
        company: {_id: ObjectId};
        logger: unknown;
        languageCode: string;
    };
    const opts = {logger, languageCode, withDeleted: false as const};
    const filter: Record<string, unknown> = {};

    if (unit && ObjectId.isValid(unit)) {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            opts as Parameters<typeof unitService.findOneOrThrow>[1],
        );
        filter.unit = foundUnit._id;
        return filter;
    }

    const unitScope: Record<string, unknown> = {company: company._id};
    if (project && ObjectId.isValid(project)) unitScope.project = new ObjectId(String(project));
    if (edifice && ObjectId.isValid(edifice)) unitScope.edifice = new ObjectId(String(edifice));
    if (floor && ObjectId.isValid(floor)) unitScope.floor = new ObjectId(String(floor));
    if (unitScope.project || unitScope.edifice || unitScope.floor) {
        const units = await unitService.find(
            unitScope,
            opts as Parameters<typeof unitService.find>[1],
            undefined,
            "_id",
        );
        filter.unit = {$in: units.map((u) => u._id)};
    }

    return filter;
}

export const {router} = createCrudRouter({
    collectionName: "snags",
    model:          Snag,
    service:        snagService,
    entityName:     "Snag",
    listSchema:     snagFormSchema,
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
    extraListFilter: snagExtraListFilter,
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
