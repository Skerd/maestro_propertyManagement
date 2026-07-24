import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {CostClassificationSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/costClassification.schema-def";
import {createCostClassificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/createCostClassification.form.validator";
import {editCostClassificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/editCostClassification.form.validator";
import CostClassification from "../../../database/schemas/costClassification/costClassification";
import {costClassificationService} from "../../../database/schemas/costClassification/costClassification.service";
import {CostClassificationActions} from "../../../database/schemas/costClassification/costClassification.actions";
import {costClassificationToDTO, costClassificationsToDTO} from "../../../utilities/mappers/costClassification/costClassificationMapper.dto";
import {costClassificationsToSelect} from "../../../utilities/mappers/costClassification/costClassificationMapper.select";

export const {router} = createCrudRouter({
    collectionName: "costclassifications",
    model: CostClassification,
    service: costClassificationService,
    entityName: "CostClassification",
    createSchema: createCostClassificationFormSchema,
    editSchema: editCostClassificationFormSchema,
    toDTO: costClassificationToDTO,
    toDTOArray: costClassificationsToDTO,
    toSelect: costClassificationsToSelect,
    defaultSort: {standard: 1, sortIndex: 1, code: 1},
    selectSearchField: "title",

    actions: CostClassificationActions,
    extraListFilter: async ({standard, active}: any) => {
        const filter: Record<string, any> = {};
        if (standard && standard !== "") filter.standard = standard;
        if (active === "true" || active === true) filter.active = true;
        if (active === "false" || active === false) filter.active = false;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(CostClassificationSchemaDef)(params);
        if (data.active === undefined || data.active === null) data.active = true;
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(CostClassificationSchemaDef)({...params, media}, writeFields);
        return data;
    },
});
