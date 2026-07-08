import {Decimal128} from 'mongodb';
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {ProjectSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/project.schema-def";
import {mediaUploadMW} from '@coreModule/utilities/middlewares/mediaUploadMW';
import {createProjectFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/createProject.form.validator";
import {editProjectFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/editProject.form.validator";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {edificeService} from "@propertyManagement/database/schemas/edifice/edifice.service";
import {floorService} from "@propertyManagement/database/schemas/floor/floor.service";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";
import {projectsToDTO, projectToDTO} from "@propertyManagement/utilities/mappers/project/projectMapper.dto";
import Project from "@propertyManagement/database/schemas/project/project";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import {projectsToSelect} from "@propertyManagement/utilities/mappers/project/projectMapper.select";
import {inspectionService} from "@propertyManagement/database/schemas/inspection/inspection.service";
import {unitCostService} from "@propertyManagement/database/schemas/unitCost/unitCost.service";
import {modificationRequestService} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.service";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";

const mediaUpload = mediaUploadMW({
    fields: {mainImage: 1, imageGallery: 10, videoGallery: 3, mediaFiles: 20, marketingBooklet: 1},
    maxFileSize: 250 * 1024 * 1024,
});

export const {router} = createCrudRouter({
    collectionName: "projects",
    model: Project,
    service: projectService,
    entityName: "Project",
    createSchema: createProjectFormSchema,
    editSchema: editProjectFormSchema,
    toDTO: projectToDTO,
    toDTOArray: projectsToDTO,
    toSelect: projectsToSelect,
    createMiddleware: [mediaUpload],
    editMiddleware: [mediaUpload],
    enrichList: async (projects, params) => {
        const {actionUserCtx, languageCode, logger} = params;
        const [statisticsMap, edificesCoordinates] = await Promise.all([
            projectService.calculateStatistics(projects.map((p: any) => p._id), actionUserCtx, languageCode, logger),
            edificeService.getEdificesCoordinatesByProjectIds(projects.map((p: any) => p._id), {logger, languageCode, actionUserCtx}),
        ]);
        return projectsToDTO(projects, statisticsMap, edificesCoordinates);
    },
    enrichSingle: async (project, params) => {
        const {actionUserCtx, languageCode, logger} = params;
        const [statisticsMap, edificesCoordinates] = await Promise.all([
            projectService.calculateStatistics([project._id], actionUserCtx, languageCode, logger),
            edificeService.getEdificesCoordinatesByProjectIds([project._id], {logger, languageCode, actionUserCtx}),
        ]);
        return projectToDTO(project, statisticsMap[project._id], edificesCoordinates[project._id.toString()]);
    },
    buildCreateData: buildCreateDataFromSchemaDef(ProjectSchemaDef, {
        saleCommissionRatePercent:        (v) => Decimal128.fromString(String(v)),
        reservationCommissionRatePercent: (v) => Decimal128.fromString(String(v)),
    }),
    buildUpdateData: buildUpdateDataFromSchemaDef(ProjectSchemaDef, {
        saleCommissionRatePercent:        (v) => Decimal128.fromString(String(v)),
        reservationCommissionRatePercent: (v) => Decimal128.fromString(String(v)),
    }),
    beforeDelete: async (params, project) => {
        const {logger, languageCode, session, actionUserCtx, company} = params;

        const edifices = await edificeService.find({project: project._id});
        if (!edifices?.length) return;

        const edificeIds = edifices.map((e: any) => e._id);

        const floors = await floorService.find(
            {edifice: {$in: edificeIds}},
            {session, logger, languageCode}
        );

        if (floors.length > 0) {
            const floorIds = floors.map((f: any) => f._id);
            const units = await unitService.find(
                {floor: {$in: floorIds}},
                {session, logger, languageCode},
                null,
                "mainImage imageGallery videoGallery"
            );
            const unitIds = units.map((u: any) => u._id);

            if (unitIds.length > 0) {
                await Promise.all([
                    inspectionService.deleteMany({unit: {$in: unitIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId}),
                    unitCostService.deleteMany({unit: {$in: unitIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId}),
                    modificationRequestService.deleteMany({unit: {$in: unitIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId}),
                    reservationService.deleteMany({unit: {$in: unitIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId}),
                    saleService.deleteMany({unit: {$in: unitIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId}),
                ]);
            }

            await unitService.deleteMany({floor: {$in: floorIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
            await floorService.deleteMany({_id: {$in: floorIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        }

        await edificeService.deleteMany({_id: {$in: edificeIds}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    },
    rateLimits: {write: 30, delete: 20},
});
