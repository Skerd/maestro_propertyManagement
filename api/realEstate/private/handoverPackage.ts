import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {HandoverPackageSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";
import {createHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/createHandoverPackage.form.validator";
import {editHandoverPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/editHandoverPackage.form.validator";
import HandoverPackage from "../../../database/schemas/handoverPackage/handoverPackage";
import {handoverPackageService} from "../../../database/schemas/handoverPackage/handoverPackage.service";
import {HandoverPackageActions} from "../../../database/schemas/handoverPackage/handoverPackage.actions";
import {handoverPackageToDTO, handoverPackagesToDTO} from "../../../utilities/mappers/handoverPackage/handoverPackageMapper.dto";
import {handoverPackagesToSelect} from "../../../utilities/mappers/handoverPackage/handoverPackageMapper.select";
import {
    assertHandoverPackageScopeAvailable,
    resolveAndFillHandoverPackageScope,
} from "../../../utilities/handoverPackage/handoverPackageChecklist";

const uploadMW = mediaUploadMW({maxFiles: 20, maxFileSize: 50 * 1024 * 1024});

export const {router} = createCrudRouter({
    collectionName: "handoverpackages",
    model: HandoverPackage,
    service: handoverPackageService,
    entityName: "HandoverPackage",
    createSchema: createHandoverPackageFormSchema,
    editSchema: editHandoverPackageFormSchema,
    toDTO: handoverPackageToDTO,
    toDTOArray: handoverPackagesToDTO,
    toSelect: handoverPackagesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    createMiddleware: [uploadMW], editMiddleware: [uploadMW],
    actions: HandoverPackageActions,
    extraListFilter: async ({projectId, edificeId, floorId, unit, unitId}: Record<string, unknown>) => {
        const filter: Record<string, unknown> = {};
        if (projectId) filter.project = new ObjectId(String(projectId));
        if (edificeId) filter.edifice = new ObjectId(String(edificeId));
        if (floorId) filter.floor = new ObjectId(String(floorId));
        const unitRaw = unit || unitId;
        if (unitRaw) filter.unit = new ObjectId(String(unitRaw));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: Record<string, unknown>) => {
        const {company, session, logger, languageCode} = params as {
            company: {_id: ObjectId};
            session?: unknown;
            logger: unknown;
            languageCode: string;
        };
        const data = buildCreateDataFromSchemaDef(HandoverPackageSchemaDef)(params);
        const scope = await resolveAndFillHandoverPackageScope(data, company._id, {session, logger, languageCode});
        await assertHandoverPackageScopeAvailable(company._id, scope, {session, logger, languageCode});
        data.project = scope.project;
        data.edifice = scope.edifice;
        data.floor = scope.floor;
        data.unit = scope.unit;
        if (Array.isArray(fileIds) && fileIds.length > 0) {
            data.media = fileIds.map((id: string) => new ObjectId(id));
        }
        return data;
    },
    buildUpdateData: async ({fileIds, media, existing, ...params}: Record<string, unknown>, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(HandoverPackageSchemaDef)({...params, media}, writeFields);
        delete data.project;
        delete data.edifice;
        delete data.floor;
        delete data.unit;
        if (writeFields.media && (media !== undefined || (Array.isArray(fileIds) && fileIds.length > 0))) {
            const kept = Array.isArray(media) ? media.filter((id: unknown) => typeof id === "string" && id.trim()) : [];
            data.media = [
                ...kept.map((id: string) => new ObjectId(id)),
                ...((fileIds as string[]) || []).map((id) => new ObjectId(id)),
            ];
        }
        return data;
    },
});
