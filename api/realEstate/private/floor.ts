import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {FloorSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/floor.schema-def";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {edificeService} from "../../../database/schemas/edifice/edifice.service";
import {floorService} from "../../../database/schemas/floor/floor.service";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {inspectionService} from "../../../database/schemas/inspection/inspection.service";
import {unitCostService} from "../../../database/schemas/unitCost/unitCost.service";
import {modificationRequestService} from "../../../database/schemas/modificationRequest/modificationRequest.service";
import {reservationService} from "../../../database/schemas/reservation/reservation.service";
import {saleService} from "../../../database/schemas/sale/sale.service";
import Floor from "../../../database/schemas/floor/floor";
import {floorsToDTO, floorToDTO} from "../../../utilities/mappers/floor/floorMapper.dto";
import {floorsToSelect} from "../../../utilities/mappers/floor/floorMapper.select";
import {createFloorFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/createFloor.form.validator";
import {editFloorFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/editFloor.form.validator";

const mediaUpload = mediaUploadMW({
    fields: { mainImage: 1, imageGallery: 10, videoGallery: 3, mediaFiles: 20, marketingBooklet: 1 },
    maxFileSize: 250 * 1024 * 1024,
});

export const { router } = createCrudRouter({
    collectionName: "floors",
    model:          Floor,
    service:        floorService,
    createSchema:   createFloorFormSchema,
    editSchema:     editFloorFormSchema,
    toDTO:          (floor) => floorToDTO(floor),
    toDTOArray:     (floors) => floorsToDTO(floors),
    toSelect:       floorsToSelect,
    defaultSort:    { levelNumber: 1 },
    selectSort:     { levelNumber: 1 },
    extraListFilter:   async ({edificeId}: any) => edificeId ? {edifice: new ObjectId(String(edificeId))} : {},
    extraSelectFilter: async ({edificeId}: any) => edificeId ? {edifice: new ObjectId(String(edificeId))} : {},
    createMiddleware: [mediaUpload],
    editMiddleware:   [mediaUpload],
    enrichList: async (floors, { actionUserCtx, languageCode, logger }) => {
        const floorIds = floors.map((f) => f._id);
        const [statisticsByFloorId, unitsCoordinatesByFloorId] = await Promise.all([
            floorService.calculateStatistics(floorIds, actionUserCtx, languageCode, { logger }),
            floorService.getUnitsCoordinatesByFloorIds(floorIds, { logger, languageCode, actionUserCtx }),
        ]);
        return floorsToDTO(floors, { statisticsByFloorId, unitsCoordinatesByFloorId });
    },
    enrichSingle: async (floor, { actionUserCtx, languageCode, logger }) => {
        const id = floor._id.toString();
        const [statisticsByFloorId, unitsCoordinatesByFloorId] = await Promise.all([
            floorService.calculateStatistics([floor._id], actionUserCtx, languageCode, { logger }),
            floorService.getUnitsCoordinatesByFloorIds([floor._id], { logger, languageCode, actionUserCtx }),
        ]);
        return floorToDTO(floor, { statistics: statisticsByFloorId[id], unitsCoordinates: unitsCoordinatesByFloorId[id] });
    },
    buildCreateData: async ({ edifice, polygonCoordinates, session, logger, languageCode, company, ...params }) => {
        const foundEdifice = await edificeService.findOneOrThrow({ _id: new ObjectId(edifice), company: company._id }, { session, logger, languageCode, withDeleted: false });

        const data = buildCreateDataFromSchemaDef(FloorSchemaDef, {})({...params, edifice: foundEdifice._id});

        const edificeProjectId = foundEdifice.project?._id ?? foundEdifice.project;
        if (edificeProjectId) data.project = edificeProjectId;

        if (polygonCoordinates !== undefined) {
            data.polygonCoordinates = polygonCoordinates.length > 0 ? polygonCoordinates : [];
        }

        return data;
    },
    buildUpdateData: async ({ edifice, polygonCoordinates, session, logger, languageCode, company, ...params }: any, writeFields) => {
        const foundEdifice = edifice != null && writeFields.edifice ? await edificeService.findOneOrThrow({ _id: new ObjectId(edifice), company: company._id }, { session, logger, languageCode, withDeleted: false }) : undefined;
        const data = buildUpdateDataFromSchemaDef(FloorSchemaDef, {})({...params, edifice: foundEdifice._id}, writeFields);

        // Keep denormalized project in sync when edifice changes
        if (foundEdifice) {
            const edificeProjectId = foundEdifice.project?._id ?? foundEdifice.project;
            data.project = edificeProjectId ?? null;
        }

        if (polygonCoordinates !== undefined && writeFields.polygonCoordinates) {
            data.polygonCoordinates = polygonCoordinates === null ? null : (polygonCoordinates.length > 0 ? polygonCoordinates : []);
        }

        return data;
    },
    enrichUpdate: async (floor, { actionUserCtx, languageCode, logger }) => {
        const id = floor._id.toString();
        const [statisticsByFloorId, unitsCoordinatesByFloorId] = await Promise.all([
            floorService.calculateStatistics([floor._id], actionUserCtx, languageCode, { logger }),
            floorService.getUnitsCoordinatesByFloorIds([floor._id], { logger, languageCode, actionUserCtx }),
        ]);
        return floorToDTO(floor, { statistics: statisticsByFloorId[id], unitsCoordinates: unitsCoordinatesByFloorId[id] });
    },
    afterDelete: async ({ _id, session, logger, languageCode, actionUserCtx }) => {
        const units = await unitService.find({ floor: new ObjectId(_id) }, { session, logger, languageCode });
        if (units.length === 0) return;
        const unitIds = units.map((u) => u._id);
        await Promise.all([
            inspectionService.deleteMany(        { unit: { $in: unitIds } }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            unitCostService.deleteMany(          { unit: { $in: unitIds } }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            modificationRequestService.deleteMany({ unit: { $in: unitIds } }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            reservationService.deleteMany(       { unit: { $in: unitIds } }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
            saleService.deleteMany(              { unit: { $in: unitIds } }, { session, logger, languageCode, auditUserId: actionUserCtx.userId }),
        ]);
        await unitService.deleteMany({ _id: { $in: unitIds } }, { session, logger, languageCode, auditUserId: actionUserCtx.userId });
    },
});
