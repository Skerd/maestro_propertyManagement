import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {activateCostClassificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/activateCostClassification.form.validator";
import {deactivateCostClassificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/deactivateCostClassification.form.validator";
import CostClassification from "./costClassification";
import {costClassificationService} from "./costClassification.service";
import {costClassificationToDTO} from "@propertyManagement/utilities/mappers/costClassification/costClassificationMapper.dto";

export class CostClassificationActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: deactivateCostClassificationFormSchema})
    async deactivate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`CostClassification.deactivate ` + String(_id) + `...`);
        const existing = await costClassificationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        if (existing.active === false) {
            throw apiValidationException("invalid_status_for_deactivate", "", null, languageCode);
        }
        await costClassificationService.updateByIdOrThrow(
            existing._id,
            {$set: {active: false}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("costclassifications").readFields!, CostClassification.schema);
            const updated = await costClassificationService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return costClassificationToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CostClassification.deactivate done`);
        return undefined;
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: activateCostClassificationFormSchema})
    async activate(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`CostClassification.activate ` + String(_id) + `...`);
        const existing = await costClassificationService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        if (existing.active === true) {
            throw apiValidationException("invalid_status_for_activate", "", null, languageCode);
        }
        await costClassificationService.updateByIdOrThrow(
            existing._id,
            {$set: {active: true}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("costclassifications").readFields!, CostClassification.schema);
            const updated = await costClassificationService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return costClassificationToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`CostClassification.activate done`);
        return undefined;
    }
}
