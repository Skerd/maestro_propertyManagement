import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {BudgetSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/budget.schema-def";
import {createBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/createBudget.form.validator";
import {editBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/editBudget.form.validator";
import Budget from "../../../database/schemas/budget/budget";
import {budgetService} from "../../../database/schemas/budget/budget.service";
import {BudgetActions} from "../../../database/schemas/budget/budget.actions";
import {budgetToDTO, budgetsToDTO} from "../../../utilities/mappers/budget/budgetMapper.dto";
import {budgetsToSelect} from "../../../utilities/mappers/budget/budgetMapper.select";


const transforms: Record<string, (v: unknown) => unknown> = {
    issuedAt: (v) => new Date(v as string),
    plannedStart: (v) => new Date(v as string),
    plannedEnd: (v) => new Date(v as string),
    startDate: (v) => new Date(v as string),
    endDate: (v) => new Date(v as string),
    claimPeriodStart: (v) => new Date(v as string),
    claimPeriodEnd: (v) => new Date(v as string),
    dueDate: (v) => new Date(v as string),
    diaryDate: (v) => new Date(v as string),
    incidentDate: (v) => new Date(v as string),
    retentionReleaseDate: (v) => new Date(v as string),
    testDate: (v) => new Date(v as string),
    decidedAt: (v) => new Date(v as string),
    expiresAt: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "budgets",
    model: Budget,
    service: budgetService,
    entityName: "Budget",
    createSchema: createBudgetFormSchema,
    editSchema: editBudgetFormSchema,
    toDTO: budgetToDTO,
    toDTOArray: budgetsToDTO,
    toSelect: budgetsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    
    actions: BudgetActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(BudgetSchemaDef, transforms)(params);
        data.status = "draft";
        
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(BudgetSchemaDef, transforms)({...params, media}, writeFields);
        
        return data;
    },
});
