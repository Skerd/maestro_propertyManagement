import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {BoqItemSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/boqItem/boqItem.schema-def";
import {createBoqItemFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/boqItem/createBoqItem.form.validator";
import {editBoqItemFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/boqItem/editBoqItem.form.validator";
import BoqItem from "../../../database/schemas/boqItem/boqItem";
import {boqItemService} from "../../../database/schemas/boqItem/boqItem.service";
import {BoqItemActions} from "../../../database/schemas/boqItem/boqItem.actions";
import {boqItemToDTO, boqItemsToDTO} from "../../../utilities/mappers/boqItem/boqItemMapper.dto";
import {boqItemsToSelect} from "../../../utilities/mappers/boqItem/boqItemMapper.select";


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
    plannedRate: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
    plannedAmount: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
    actualAmount: (v: unknown) => { const {Decimal128} = require("mongodb"); return v != null && v !== "" ? Decimal128.fromString(String(v)) : undefined; },
};

export const {router} = createCrudRouter({
    collectionName: "boqitems",
    model: BoqItem,
    service: boqItemService,
    entityName: "BoqItem",
    createSchema: createBoqItemFormSchema,
    editSchema: editBoqItemFormSchema,
    toDTO: boqItemToDTO,
    toDTOArray: boqItemsToDTO,
    toSelect: boqItemsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    
    actions: BoqItemActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(BoqItemSchemaDef, transforms)(params);
        data.status = "active";
        
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(BoqItemSchemaDef, transforms)({...params, media}, writeFields);
        
        return data;
    },
});
