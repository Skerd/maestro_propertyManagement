import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {SpecificationItemSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/specificationItem.schema-def";
import {createSpecificationItemFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/createSpecificationItem.form.validator";
import {editSpecificationItemFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/editSpecificationItem.form.validator";
import SpecificationItem from "../../../database/schemas/specificationItem/specificationItem";
import {specificationItemService} from "../../../database/schemas/specificationItem/specificationItem.service";
import {SpecificationItemActions} from "../../../database/schemas/specificationItem/specificationItem.actions";
import {specificationItemToDTO, specificationItemsToDTO} from "../../../utilities/mappers/specificationItem/specificationItemMapper.dto";
import {specificationItemsToSelect} from "../../../utilities/mappers/specificationItem/specificationItemMapper.select";

function computeLineTotal(quantity: unknown, unitPrice: unknown): number | undefined {
    const q = quantity == null || quantity === "" ? undefined : Number(quantity);
    const p = unitPrice == null || unitPrice === "" ? undefined : Number(unitPrice);
    if (q === undefined || p === undefined || Number.isNaN(q) || Number.isNaN(p)) return undefined;
    return q * p;
}

export const {router} = createCrudRouter({
    collectionName: "specificationitems",
    model: SpecificationItem,
    service: specificationItemService,
    entityName: "SpecificationItem",
    createSchema: createSpecificationItemFormSchema,
    editSchema: editSpecificationItemFormSchema,
    toDTO: specificationItemToDTO,
    toDTOArray: specificationItemsToDTO,
    toSelect: specificationItemsToSelect,
    defaultSort: {sortIndex: 1, createdAt: 1},
    selectSearchField: "title",

    actions: SpecificationItemActions,
    extraListFilter: async ({specificationId, projectId, status}: any) => {
        const filter: Record<string, any> = {};
        if (specificationId && specificationId !== "") filter.specification = new ObjectId(String(specificationId));
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(SpecificationItemSchemaDef)(params);
        const lineTotal = computeLineTotal(params.quantity, params.unitPrice);
        if (lineTotal !== undefined) data.lineTotal = lineTotal;
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(SpecificationItemSchemaDef)({...params, media}, writeFields);
        const lineTotal = computeLineTotal(params.quantity, params.unitPrice);
        if (lineTotal !== undefined) data.lineTotal = lineTotal;
        return data;
    },
});
