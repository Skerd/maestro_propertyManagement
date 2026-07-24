import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {activateAssetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/activateAsset.form.validator";
import {retireAssetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/retireAsset.form.validator";
import {setMaintenanceAssetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/asset/setMaintenanceAsset.form.validator";
import Asset from "./asset";
import {assetService} from "./asset.service";
import {assetToDTO} from "@propertyManagement/utilities/mappers/asset/assetMapper.dto";

async function transition(params: Record<string, any>, label: string, next: string): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id} = params;
    const existing = await assetService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
    if ((existing.lifecycleStatus ?? "active") === "retired" && next !== "active") {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    await assetService.updateByIdOrThrow(existing._id, {$set: {lifecycleStatus: next}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("assets").readFields!, Asset.schema);
        const updated = await assetService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return assetToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

export class AssetActions {
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: activateAssetFormSchema})
    async activate(params: Record<string, any>): Promise<any> { return transition(params, "activate", "active"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: setMaintenanceAssetFormSchema})
    async setMaintenance(params: Record<string, any>): Promise<any> { return transition(params, "setMaintenance", "maintenance"); }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: retireAssetFormSchema})
    async retire(params: Record<string, any>): Promise<any> { return transition(params, "retire", "retired"); }
}
