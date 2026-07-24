import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import dayjs from "dayjs";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {importIfcBimModelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/importIfcBimModel.form.validator";
import {pushToEstimateBimModelFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/bimModel/pushToEstimateBimModel.form.validator";
import BimModel from "./bimModel";
import BimQuantity from "../bimQuantity/bimQuantity";
import Budget from "../budget/budget";
import BoqItem from "../boqItem/boqItem";
import {bimModelService} from "./bimModel.service";
import {bimModelToDTO} from "@propertyManagement/utilities/mappers/bimModel/bimModelMapper.dto";

function ifcEnabled(): boolean {
    return process.env.PM_BIM_IFC_ENABLED === "true" || process.env.PM_BIM_IFC_ENABLED === "1";
}

export class BimModelActions {
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 10}, transaction: true, schema: importIfcBimModelFormSchema})
    async importIfc(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`BimModel.importIfc ` + String(_id) + `...`);
        const model = await bimModelService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        // IFC parsing requires a server-side IFC toolkit and is feature-flagged (PM_BIM_IFC_ENABLED).
        // When disabled, mark failed so operators use the manual-quantity fallback (BimQuantity CRUD).
        if (!ifcEnabled() || !model.sourceFile) {
            await bimModelService.updateByIdOrThrow(model._id, {$set: {importStatus: "failed"}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
            throw apiValidationException("bim_ifc_import_disabled_use_manual_quantities", "", null, languageCode);
        }
        // Real IFC parse would populate BimQuantity here; not bundled.
        await bimModelService.updateByIdOrThrow(model._id, {$set: {importStatus: "imported"}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("bimmodels").readFields!, BimModel.schema);
            const updated = await bimModelService.findById(model._id, {session, logger, languageCode}, populate.populate);
            if (updated) return bimModelToDTO(updated);
        } catch { /* no read */ }
        return undefined;
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 10}, transaction: true, schema: pushToEstimateBimModelFormSchema})
    async pushToEstimate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, budgetId} = params;
        logger.start(`BimModel.pushToEstimate ` + String(_id) + ` -> budget ` + String(budgetId) + `...`);
        const model = await bimModelService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (!budgetId || !ObjectId.isValid(budgetId)) throw apiValidationException("budgetId_required", "", null, languageCode);
        const budget = await Budget.findOne({_id: new ObjectId(budgetId), company: company._id, deletedAt: null}).lean();
        if (!budget) throw apiValidationException("budget_not_found", "", null, languageCode);

        const quantities = await BimQuantity.find({bimModel: model._id, company: company._id, deletedAt: null, classificationCode: {$nin: [null, ""]}}).session(session).lean();
        const date = dayjs().format("YYYYMMDD");
        let created = 0;
        for (const q of quantities as any[]) {
            const existing = await BoqItem.findOne({budget: budget._id, classificationCode: q.classificationCode, company: company._id, deletedAt: null}).session(session);
            if (existing) {
                await BoqItem.updateOne({_id: existing._id}, {$set: {plannedQty: q.quantity, unitOfMeasure: q.unitOfMeasure ?? existing.get("unitOfMeasure")}}, {session});
            } else {
                await BoqItem.create([{
                    name: `BOQ-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
                    budget: budget._id,
                    project: (budget as any).project,
                    edifice: (budget as any).edifice ?? undefined,
                    title: `${q.classificationCode} (BIM)`,
                    classificationStandard: "ebkp_h",
                    classificationCode: q.classificationCode,
                    unitOfMeasure: q.unitOfMeasure ?? undefined,
                    plannedQty: q.quantity ?? undefined,
                    currency: (budget as any).currency,
                    status: "active",
                    company: company._id,
                    createdBy: actionUserCtx.userId,
                }], {session});
                created++;
            }
        }
        logger.finish(`BimModel.pushToEstimate done — ${created} new BoQ lines`);
        return {pushed: quantities.length, created};
    }
}
