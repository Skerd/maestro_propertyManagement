import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {BimModelSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/bimModel.schema-def";
import {createBimModelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/createBimModel.form.validator";
import {editBimModelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/editBimModel.form.validator";
import BimModel from "../../../database/schemas/bimModel/bimModel";
import {bimModelService} from "../../../database/schemas/bimModel/bimModel.service";
import {BimModelActions} from "../../../database/schemas/bimModel/bimModel.actions";
import {bimModelToDTO, bimModelsToDTO} from "../../../utilities/mappers/bimModel/bimModelMapper.dto";
import {bimModelsToSelect} from "../../../utilities/mappers/bimModel/bimModelMapper.select";
export const {router} = createCrudRouter({
    collectionName: "bimmodels", model: BimModel, service: bimModelService, entityName: "BimModel",
    createSchema: createBimModelFormSchema, editSchema: editBimModelFormSchema,
    toDTO: bimModelToDTO, toDTOArray: bimModelsToDTO, toSelect: bimModelsToSelect,
    defaultSort: {createdAt: -1}, selectSearchField: "title", actions: BimModelActions,
    extraListFilter: async ({projectId, importStatus}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (importStatus && importStatus !== "") filter.importStatus = importStatus;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => { const d = buildCreateDataFromSchemaDef(BimModelSchemaDef)(params); d.importStatus = "uploaded"; return d; },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(BimModelSchemaDef)({...params, media}, writeFields),
});
