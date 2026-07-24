import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Asset, {IAsset} from "./asset";
export class AssetService extends BaseCrudService<IAsset, typeof Asset> {
    constructor() { super(Asset, "Asset"); }
}
export const assetService = new AssetService();
