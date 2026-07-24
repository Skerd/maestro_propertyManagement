import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {BidLineSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/bidLine/bidLine.schema-def";
import {createBidLineFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bidLine/createBidLine.form.validator";
import {editBidLineFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bidLine/editBidLine.form.validator";
import BidLine from "../../../database/schemas/bidLine/bidLine";
import {bidLineService} from "../../../database/schemas/bidLine/bidLine.service";
import {bidLineToDTO, bidLinesToDTO} from "../../../utilities/mappers/bidLine/bidLineMapper.dto";
import {bidLinesToSelect} from "../../../utilities/mappers/bidLine/bidLineMapper.select";

function computeLineTotal(quantity: unknown, unitPrice: unknown): number | undefined {
    const q = quantity == null || quantity === "" ? undefined : Number(quantity);
    const p = unitPrice == null || unitPrice === "" ? undefined : Number(unitPrice);
    if (q === undefined || p === undefined || Number.isNaN(q) || Number.isNaN(p)) return undefined;
    return q * p;
}

export const {router} = createCrudRouter({
    collectionName: "bidlines",
    model: BidLine,
    service: bidLineService,
    entityName: "BidLine",
    createSchema: createBidLineFormSchema,
    editSchema: editBidLineFormSchema,
    toDTO: bidLineToDTO,
    toDTOArray: bidLinesToDTO,
    toSelect: bidLinesToSelect,
    defaultSort: {sortIndex: 1, createdAt: 1},
    selectSearchField: "title",

    extraListFilter: async ({bidId}: any) => {
        const filter: Record<string, any> = {};
        if (bidId && bidId !== "") filter.bid = new ObjectId(String(bidId));
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(BidLineSchemaDef)(params);
        const lt = computeLineTotal(params.quantity, params.unitPrice);
        if (lt !== undefined) data.lineTotal = lt;
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(BidLineSchemaDef)({...params, media}, writeFields);
        const lt = computeLineTotal(params.quantity, params.unitPrice);
        if (lt !== undefined) data.lineTotal = lt;
        return data;
    },
});
