import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {MaintenancePlanSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/maintenancePlan.schema-def";
import {createMaintenancePlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/createMaintenancePlan.form.validator";
import {editMaintenancePlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/editMaintenancePlan.form.validator";
import MaintenancePlan from "../../../database/schemas/maintenancePlan/maintenancePlan";
import {maintenancePlanService} from "../../../database/schemas/maintenancePlan/maintenancePlan.service";
import {MaintenancePlanActions} from "../../../database/schemas/maintenancePlan/maintenancePlan.actions";
import {maintenancePlanToDTO, maintenancePlansToDTO} from "../../../utilities/mappers/maintenancePlan/maintenancePlanMapper.dto";
import {maintenancePlansToSelect} from "../../../utilities/mappers/maintenancePlan/maintenancePlanMapper.select";
const transforms: Record<string, (v: unknown) => unknown> = {nextDueAt: (v) => new Date(v as string)};
export const {router} = createCrudRouter({
    collectionName: "maintenanceplans", model: MaintenancePlan, service: maintenancePlanService, entityName: "MaintenancePlan",
    createSchema: createMaintenancePlanFormSchema, editSchema: editMaintenancePlanFormSchema,
    toDTO: maintenancePlanToDTO, toDTOArray: maintenancePlansToDTO, toSelect: maintenancePlansToSelect,
    defaultSort: {nextDueAt: 1, createdAt: -1}, selectSearchField: "title", actions: MaintenancePlanActions,
    extraListFilter: async ({assetId, edificeId}: any) => {
        const filter: Record<string, any> = {};
        if (assetId && assetId !== "") filter.asset = new ObjectId(String(assetId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => { const d = buildCreateDataFromSchemaDef(MaintenancePlanSchemaDef, transforms)(params); if (d.active === undefined || d.active === null) d.active = true; return d; },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(MaintenancePlanSchemaDef, transforms)({...params, media}, writeFields),
});
