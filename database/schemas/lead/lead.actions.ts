import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {schemaSanitizer} from "@coreModule/utilities/middlewares/schemaSanitizerMW";
import {addLeadActivityFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/addLeadActivity.form.validator";
import type {Lead as LeadData} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.dto";
import {leadToDTO} from "@propertyManagement/utilities/mappers/lead/leadMapper.dto";
import Lead from "./lead";
import {leadService} from "./lead.service";

export class LeadActions {

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 60},
        transaction: true,
        middleware:  [schemaSanitizer({model: "leads", requiredModes: ["write"]})], // TODO check this, it need to check for activity keys, not whole schema
        schema:      addLeadActivityFormSchema,
    })
    async addActivity(params: Record<string, any>): Promise<LeadData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, action, notes} = params;

        logger.start(`Adding activity to lead ${_id}...`);

        const lead = await leadService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        const entry = {
            action,
            notes,
            performedBy: new ObjectId(actionUserCtx.userId),
            performedAt: new Date(),
        };

        await leadService.updateByIdOrThrow(
            lead._id,
            {$push: {activityLog: entry}},
            {session, logger, languageCode, actionUserCtx},
        );

        let returnData: LeadData | undefined;
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("leads").readFields!, Lead.schema);
            const updated = await leadService.findById(
                lead._id,
                {session, logger, languageCode},
                populate.populate,
            );
            if (updated) returnData = leadToDTO(updated);
        } catch {
            logger.debug("User has no read permission on lead after adding activity");
        }

        logger.finish(`Added activity to lead ${_id}`);
        return returnData;
    }
}
