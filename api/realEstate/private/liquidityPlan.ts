import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {LiquidityPlanSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/liquidityPlan.schema-def";
import {createLiquidityPlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/createLiquidityPlan.form.validator";
import {editLiquidityPlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/editLiquidityPlan.form.validator";
import LiquidityPlan from "../../../database/schemas/liquidityPlan/liquidityPlan";
import {liquidityPlanService} from "../../../database/schemas/liquidityPlan/liquidityPlan.service";
import {LiquidityPlanActions} from "../../../database/schemas/liquidityPlan/liquidityPlan.actions";
import {liquidityPlanToDTO, liquidityPlansToDTO} from "../../../utilities/mappers/liquidityPlan/liquidityPlanMapper.dto";
import {liquidityPlansToSelect} from "../../../utilities/mappers/liquidityPlan/liquidityPlanMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    horizonStart: (v) => new Date(v as string),
    horizonEnd: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "liquidityplans",
    model: LiquidityPlan,
    service: liquidityPlanService,
    entityName: "LiquidityPlan",
    createSchema: createLiquidityPlanFormSchema,
    editSchema: editLiquidityPlanFormSchema,
    toDTO: liquidityPlanToDTO,
    toDTOArray: liquidityPlansToDTO,
    toSelect: liquidityPlansToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    actions: LiquidityPlanActions,
    extraListFilter: async ({projectId}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => buildCreateDataFromSchemaDef(LiquidityPlanSchemaDef, transforms)(params),
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(LiquidityPlanSchemaDef, transforms)({...params, media}, writeFields),
});
