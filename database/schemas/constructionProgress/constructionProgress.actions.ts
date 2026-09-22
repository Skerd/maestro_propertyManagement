import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import ConstructionProgress from "./constructionProgress";
import {constructionProgressService} from "./constructionProgress.service";
import {notifyConstructionProgressClients} from "@propertyManagement/utilities/constructionProgress/notifyConstructionProgressClients";

export class ConstructionProgressActions {

    /**
     * Re-sends the in-app notification + email (with site photos) to every client currently in the
     * report's scope, regardless of whether the report advanced progress or had `notifyClients` on.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        schema: validateSingleForm,
    })
    async resendClientNotifications(params: Record<string, any>): Promise<{ok: true; recipients: number}> {
        const {logger, languageCode, _id, actionUserCtx, company} = params;

        logger.start(`Resending client notifications for construction progress: ${_id}`);
        try {
            SchemaGuard.sanitizeFields(ConstructionProgress, {notifyClients: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("construction_progress_not_found", "", null, languageCode);
        }

        const progress = await constructionProgressService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {logger, languageCode},
        );
        if (progress.deletedAt) {
            throw apiValidationException("construction_progress_not_found", "", null, languageCode);
        }

        const recipients = await notifyConstructionProgressClients(progress._id as ObjectId, {languageCode: languageCode ?? "en-US"});
        if (!recipients) {
            throw apiValidationException("no_clients_to_notify", "", null, languageCode);
        }

        logger.finish(`Resent construction progress notifications to ${recipients} client(s)`);
        return {ok: true, recipients};
    }
}
