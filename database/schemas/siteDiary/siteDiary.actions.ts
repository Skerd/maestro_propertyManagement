import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {publishSiteDiaryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/siteDiary/publishSiteDiary.form.validator";
import SiteDiary from "./siteDiary";
import {siteDiaryService} from "./siteDiary.service";
import {siteDiaryToDTO} from "@propertyManagement/utilities/mappers/siteDiary/siteDiaryMapper.dto";

export class SiteDiaryActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: publishSiteDiaryFormSchema})
    async publish(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`SiteDiary.publish ` + String(_id) + `...`);
        const existing = await siteDiaryService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_publish", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "published"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await siteDiaryService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("sitediaries").readFields!, SiteDiary.schema);
            const updated = await siteDiaryService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return siteDiaryToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`SiteDiary.publish done`);
        return undefined;
    }
}
