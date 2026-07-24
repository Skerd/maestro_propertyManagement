import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {LiquidityLineSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityLine/liquidityLine.schema-def";
import {createLiquidityLineFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityLine/createLiquidityLine.form.validator";
import {editLiquidityLineFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityLine/editLiquidityLine.form.validator";
import LiquidityLine from "../../../database/schemas/liquidityLine/liquidityLine";
import {liquidityLineService} from "../../../database/schemas/liquidityLine/liquidityLine.service";
import {liquidityLineToDTO, liquidityLinesToDTO} from "../../../utilities/mappers/liquidityLine/liquidityLineMapper.dto";
import {liquidityLinesToSelect} from "../../../utilities/mappers/liquidityLine/liquidityLineMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    period: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "liquiditylines",
    model: LiquidityLine,
    service: liquidityLineService,
    entityName: "LiquidityLine",
    createSchema: createLiquidityLineFormSchema,
    editSchema: editLiquidityLineFormSchema,
    toDTO: liquidityLineToDTO,
    toDTOArray: liquidityLinesToDTO,
    toSelect: liquidityLinesToSelect,
    defaultSort: {period: 1, createdAt: 1},
    selectSearchField: "title",
    extraListFilter: async ({planId, direction}: any) => {
        const filter: Record<string, any> = {};
        if (planId && planId !== "") filter.plan = new ObjectId(String(planId));
        if (direction && direction !== "") filter.direction = direction;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(LiquidityLineSchemaDef, transforms)(params);
        if (!data.source) data.source = "manual";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(LiquidityLineSchemaDef, transforms)({...params, media}, writeFields),
});
