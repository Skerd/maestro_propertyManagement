import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {AssetSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/asset.schema-def";
import {createAssetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/createAsset.form.validator";
import {editAssetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/editAsset.form.validator";
import Asset from "../../../database/schemas/asset/asset";
import {assetService} from "../../../database/schemas/asset/asset.service";
import {AssetActions} from "../../../database/schemas/asset/asset.actions";
import {assetToDTO, assetsToDTO} from "../../../utilities/mappers/asset/assetMapper.dto";
import {assetsToSelect} from "../../../utilities/mappers/asset/assetMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {installDate: (v) => new Date(v as string)};

export const {router} = createCrudRouter({
    collectionName: "assets", model: Asset, service: assetService, entityName: "Asset",
    createSchema: createAssetFormSchema, editSchema: editAssetFormSchema,
    toDTO: assetToDTO, toDTOArray: assetsToDTO, toSelect: assetsToSelect,
    defaultSort: {createdAt: -1}, selectSearchField: "title", actions: AssetActions,
    extraListFilter: async ({edificeId, category, lifecycleStatus}: any) => {
        const filter: Record<string, any> = {};
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (category && category !== "") filter.category = category;
        if (lifecycleStatus && lifecycleStatus !== "") filter.lifecycleStatus = lifecycleStatus;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => { const d = buildCreateDataFromSchemaDef(AssetSchemaDef, transforms)(params); d.lifecycleStatus = "active"; return d; },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(AssetSchemaDef, transforms)({...params, media}, writeFields),
});
