import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {BimQuantitySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimQuantity/bimQuantity.schema-def";
import {createBimQuantityFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimQuantity/createBimQuantity.form.validator";
import {editBimQuantityFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimQuantity/editBimQuantity.form.validator";
import BimQuantity from "../../../database/schemas/bimQuantity/bimQuantity";
import {bimQuantityService} from "../../../database/schemas/bimQuantity/bimQuantity.service";
import {bimQuantityToDTO, bimQuantitiesToDTO} from "../../../utilities/mappers/bimQuantity/bimQuantityMapper.dto";
import {bimQuantitiesToSelect} from "../../../utilities/mappers/bimQuantity/bimQuantityMapper.select";
export const {router} = createCrudRouter({
    collectionName: "bimquantities", model: BimQuantity, service: bimQuantityService, entityName: "BimQuantity",
    createSchema: createBimQuantityFormSchema, editSchema: editBimQuantityFormSchema,
    toDTO: bimQuantityToDTO, toDTOArray: bimQuantitiesToDTO, toSelect: bimQuantitiesToSelect,
    defaultSort: {createdAt: -1}, selectSearchField: "classificationCode",
    extraListFilter: async ({bimModelId}: any) => {
        const filter: Record<string, any> = {};
        if (bimModelId && bimModelId !== "") filter.bimModel = new ObjectId(String(bimModelId));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => buildCreateDataFromSchemaDef(BimQuantitySchemaDef)(params),
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(BimQuantitySchemaDef)({...params, media}, writeFields),
});
