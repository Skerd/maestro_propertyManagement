import {ObjectId} from "mongodb";
import Lead, {LeadInterest, LeadSource, LeadStatus} from "./lead";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {leadsSeed} from "@propertyManagement/database/seeds/operations/leads.seed";
import {
    opt,
    optDate,
    optDecimal,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";

export {leadsSeed as defaultLeads};

/**
 * Seeds the sales pipeline — leads across every stage from `new` to `won` / `lost`,
 * each with the activity log the CRM views render.
 */
export async function createLeads(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    projectIds: Map<string, ObjectId>,
    unitIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createLeads", parentLogger);
    logger.start(`Creating leads (${leadsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of leadsSeed) {
        try {
            const leadId = new ObjectId(row.id);
            const payload = {
                firstName: row.firstName,
                ...opt("lastName", row.lastName),
                email: row.email,
                ...opt("phone", row.phone),
                status: row.status as LeadStatus,
                ...opt("source", row.source as LeadSource | undefined),
                ...opt("interest", row.interest as LeadInterest | undefined),
                ...opt("projectInterest", row.projectInterest ? projectIds.get(row.projectInterest) : undefined),
                ...opt("unitInterest", row.unitInterest ? unitIds.get(row.unitInterest) : undefined),
                ...optDecimal("budget", row.budget),
                ...opt("budgetCurrency", resolveCurrency(refs, row.budgetCurrency)),
                ...opt("notes", row.notes),
                ...opt("assignedTo", resolveUser(refs, row.assignedTo)),
                ...optDate("followUpDate", row.followUpDate),
                ...optDate("convertedAt", row.convertedAt),
                activityLog: row.activityLog.map((entry) => ({
                    action: entry.action,
                    notes: entry.notes,
                    ...opt("performedBy", resolveUser(refs, entry.performedBy)),
                    performedAt: new Date(entry.performedAt),
                })),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Lead.findById(leadId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Lead.create({_id: leadId, ...payload});
            }

            created.set(row.id, leadId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating lead ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating leads!", created.size);
    return created;
}
