import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {cancelSpecificationItemFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/cancelSpecificationItem.form.validator";
import SpecificationItem from "./specificationItem";
import {specificationItemService} from "./specificationItem.service";
import {specificationItemToDTO} from "@propertyManagement/utilities/mappers/specificationItem/specificationItemMapper.dto";

export class SpecificationItemActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: cancelSpecificationItemFormSchema})
    async cancel(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`SpecificationItem.cancel ` + String(_id) + `...`);
        const existing = await specificationItemService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "active";
        if (!["active"].includes(status)) {
            throw apiValidationException("invalid_status_for_cancel", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "cancelled"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await specificationItemService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("specificationitems").readFields!, SpecificationItem.schema);
            const updated = await specificationItemService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return specificationItemToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`SpecificationItem.cancel done`);
        return undefined;
    }
}
