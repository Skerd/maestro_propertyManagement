import {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {adCampaignTemplatesSeed} from "@propertyManagement/database/seeds/operations/adCampaignTemplates.seed";
import {sanitizeAdCampaignHtml} from "@propertyManagement/utilities/emails/adCampaignHtmlSanitizer";
import AdCampaignTemplate from "./adCampaignTemplate";

export {adCampaignTemplatesSeed as defaultAdCampaignTemplates};

/**
 * Seeds the three shipped campaign templates, one per campaign type.
 *
 * Lookup is by preserved id, then by the **natural key**
 * (`company` + `name` + `campaignType` + `locale`) — deliberately not the
 * `upsertByName` helper the workflow seeds use, because a template's `name` is
 * shared by its locale siblings and is therefore not unique on its own. Looking
 * up by name alone would make an `en-US` seed overwrite a company's `de-CH`
 * translation of the same template.
 *
 * Bodies are sanitized here as well as in the router: this path writes straight
 * to the model, so it is exactly the "future import path that bypasses the
 * router" the sanitizer's docblock warns about.
 *
 * @returns campaignType → `AdCampaignTemplate._id`, so a campaign seed could
 *          attach one without re-querying.
 */
export async function createAdCampaignTemplates(
    parentLogger: serverLogger,
    company: ICompany,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createAdCampaignTemplates", parentLogger);
    logger.start(`Creating ad campaign templates (${adCampaignTemplatesSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const seedRow of adCampaignTemplatesSeed) {
        try {
            const templateId = new ObjectId(seedRow.id);
            const payload = {
                name: seedRow.name,
                campaignType: seedRow.campaignType,
                locale: seedRow.locale,
                subject: seedRow.subject,
                previewText: seedRow.previewText,
                bodyHtml: sanitizeAdCampaignHtml(seedRow.bodyHtml),
                isDefault: seedRow.isDefault,
                active: seedRow.active,
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing =
                (await AdCampaignTemplate.findById(templateId)) ??
                (await AdCampaignTemplate.findOne({
                    company: company._id,
                    name: seedRow.name,
                    campaignType: seedRow.campaignType,
                    locale: seedRow.locale,
                }));

            if (existing) {
                existing.set(payload);
                await existing.save();
                created.set(seedRow.campaignType, existing._id as ObjectId);
                continue;
            }

            await AdCampaignTemplate.create({_id: templateId, ...payload});
            created.set(seedRow.campaignType, templateId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating ad campaign template "${seedRow.name}": ${message}`);
        }
    }

    logger.finish("Finished creating ad campaign templates!", created.size);
    return created;
}
