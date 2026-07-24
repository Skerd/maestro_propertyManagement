import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {PlanMarkupSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/planMarkup.schema-def";
import {createPlanMarkupFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/createPlanMarkup.form.validator";
import {editPlanMarkupFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/editPlanMarkup.form.validator";
import PlanMarkup from "../../../database/schemas/planMarkup/planMarkup";
import {planMarkupService} from "../../../database/schemas/planMarkup/planMarkup.service";
import {PlanMarkupActions} from "../../../database/schemas/planMarkup/planMarkup.actions";
import {planMarkupToDTO, planMarkupsToDTO} from "../../../utilities/mappers/planMarkup/planMarkupMapper.dto";
import {planMarkupsToSelect} from "../../../utilities/mappers/planMarkup/planMarkupMapper.select";

export const {router} = createCrudRouter({
    collectionName: "planmarkups",
    model: PlanMarkup,
    service: planMarkupService,
    entityName: "PlanMarkup",
    createSchema: createPlanMarkupFormSchema,
    editSchema: editPlanMarkupFormSchema,
    toDTO: planMarkupToDTO,
    toDTOArray: planMarkupsToDTO,
    toSelect: planMarkupsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    actions: PlanMarkupActions,
    extraListFilter: async ({planDocumentId, projectId, status, markerType}: any) => {
        const filter: Record<string, any> = {};
        if (planDocumentId && planDocumentId !== "") filter.planDocument = new ObjectId(String(planDocumentId));
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (status && status !== "") filter.status = status;
        if (markerType && markerType !== "") filter.markerType = markerType;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(PlanMarkupSchemaDef)(params);
        data.status = "open";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(PlanMarkupSchemaDef)({...params, media}, writeFields),
});
