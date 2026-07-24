import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {BidSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/bid.schema-def";
import {createBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/createBid.form.validator";
import {editBidFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bid/editBid.form.validator";
import Bid from "../../../database/schemas/bid/bid";
import {bidService} from "../../../database/schemas/bid/bid.service";
import {BidActions} from "../../../database/schemas/bid/bid.actions";
import {bidToDTO, bidsToDTO} from "../../../utilities/mappers/bid/bidMapper.dto";
import {bidsToSelect} from "../../../utilities/mappers/bid/bidMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    submittedAt: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "bids",
    model: Bid,
    service: bidService,
    entityName: "Bid",
    createSchema: createBidFormSchema,
    editSchema: editBidFormSchema,
    toDTO: bidToDTO,
    toDTOArray: bidsToDTO,
    toSelect: bidsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "name",

    actions: BidActions,
    extraListFilter: async ({tenderId, constructorId, status}: any) => {
        const filter: Record<string, any> = {};
        if (tenderId && tenderId !== "") filter.tender = new ObjectId(String(tenderId));
        if (constructorId && constructorId !== "") filter.constructorRef = new ObjectId(String(constructorId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(BidSchemaDef, transforms)(params);
        data.status = "draft";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(BidSchemaDef, transforms)({...params, media}, writeFields);
        return data;
    },
});
