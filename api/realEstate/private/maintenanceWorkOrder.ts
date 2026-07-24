import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {MaintenanceWorkOrderSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/maintenanceWorkOrder.schema-def";
import {createMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/createMaintenanceWorkOrder.form.validator";
import {editMaintenanceWorkOrderFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/editMaintenanceWorkOrder.form.validator";
import MaintenanceWorkOrder from "../../../database/schemas/maintenanceWorkOrder/maintenanceWorkOrder";
import {maintenanceWorkOrderService} from "../../../database/schemas/maintenanceWorkOrder/maintenanceWorkOrder.service";
import {MaintenanceWorkOrderActions} from "../../../database/schemas/maintenanceWorkOrder/maintenanceWorkOrder.actions";
import {maintenanceWorkOrderToDTO, maintenanceWorkOrdersToDTO} from "../../../utilities/mappers/maintenanceWorkOrder/maintenanceWorkOrderMapper.dto";
import {maintenanceWorkOrdersToSelect} from "../../../utilities/mappers/maintenanceWorkOrder/maintenanceWorkOrderMapper.select";
const transforms: Record<string, (v: unknown) => unknown> = {dueDate: (v) => new Date(v as string)};
export const {router} = createCrudRouter({
    collectionName: "maintenanceworkorders", model: MaintenanceWorkOrder, service: maintenanceWorkOrderService, entityName: "MaintenanceWorkOrder",
    createSchema: createMaintenanceWorkOrderFormSchema, editSchema: editMaintenanceWorkOrderFormSchema,
    toDTO: maintenanceWorkOrderToDTO, toDTOArray: maintenanceWorkOrdersToDTO, toSelect: maintenanceWorkOrdersToSelect,
    defaultSort: {createdAt: -1}, selectSearchField: "title", actions: MaintenanceWorkOrderActions,
    extraListFilter: async ({planId, assetId, status}: any) => {
        const filter: Record<string, any> = {};
        if (planId && planId !== "") filter.plan = new ObjectId(String(planId));
        if (assetId && assetId !== "") filter.asset = new ObjectId(String(assetId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => { const d = buildCreateDataFromSchemaDef(MaintenanceWorkOrderSchemaDef, transforms)(params); d.status = "open"; return d; },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(MaintenanceWorkOrderSchemaDef, transforms)({...params, media}, writeFields),
});
