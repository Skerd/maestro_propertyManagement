import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {cancelBoqItemFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/boqItem/cancelBoqItem.form.validator";
import BoqItem from "./boqItem";
import {boqItemService} from "./boqItem.service";
import {boqItemToDTO} from "@propertyManagement/utilities/mappers/boqItem/boqItemMapper.dto";

export class BoqItemActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: cancelBoqItemFormSchema})
    async cancel(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`BoqItem.cancel ` + String(_id) + `...`);
        const existing = await boqItemService.findOneOrThrow(
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
        await boqItemService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("boqitems").readFields!, BoqItem.schema);
            const updated = await boqItemService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return boqItemToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`BoqItem.cancel done`);
        return undefined;
    }
}
