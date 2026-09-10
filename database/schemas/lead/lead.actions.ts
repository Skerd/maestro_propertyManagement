import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {schemaSanitizer} from "@coreModule/utilities/middlewares/schemaSanitizerMW";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {addLeadActivityFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/addLeadActivity.form.validator";
import {closeLeadFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/closeLead.form.validator";
import type {LeadCloseOutcome} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/closeLead.form.type";
import {leadTransitionFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/leadTransition.form.validator";
import {LEAD_LONG_TEXT_MAX} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.schema-def";
import {LEAD_WORKFLOW_ACTIVITY_ACTION} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/leadActivity.constants";
import type {Lead as LeadData} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.dto";
import {leadToDTO} from "@propertyManagement/utilities/mappers/lead/leadMapper.dto";
import Lead, {ILead, LeadStatus} from "./lead";
import {leadService} from "./lead.service";

const OPEN_STATUSES = new Set<LeadStatus>([
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.PROPOSAL,
    LeadStatus.NEGOTIATION,
]);

const STATUS_RANK: Record<string, number> = {
    [LeadStatus.NEW]:         0,
    [LeadStatus.CONTACTED]:   1,
    [LeadStatus.QUALIFIED]:   2,
    [LeadStatus.PROPOSAL]:    3,
    [LeadStatus.NEGOTIATION]: 4,
};

function isOpen(status: LeadStatus): boolean {
    return OPEN_STATUSES.has(status);
}

function canAdvanceTo(current: LeadStatus, destination: LeadStatus): boolean {
    if (!isOpen(current)) return false;
    const from = STATUS_RANK[current];
    const to = STATUS_RANK[destination];
    return from != null && to != null && from < to;
}

function hasContact(lead: ILead): boolean {
    return Boolean(lead.email || lead.phone);
}

function hasQualifyFacts(lead: ILead): boolean {
    return Boolean(lead.interest && (lead.projectInterest || lead.unitInterest));
}

function joinActivityNotes(...parts: (string | undefined)[]): string | undefined {
    const text = parts.map((part) => part?.trim()).filter(Boolean).join("\n");
    if (!text) return undefined;
    return text.length > LEAD_LONG_TEXT_MAX ? text.slice(0, LEAD_LONG_TEXT_MAX) : text;
}

type TransitionParams = {
    logger: {start: (m: string) => void; finish: (m: string) => void; debug: (m: string) => void};
    languageCode: string;
    session: unknown;
    actionUserCtx: {userId: string};
    company: {_id: ObjectId};
    _id: string;
};

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

        const returnData = await this.reloadLeadDto(lead._id, params);
        logger.finish(`Added activity to lead ${_id}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      leadTransitionFormSchema,
    })
    async markContacted(params: Record<string, any>): Promise<LeadData | undefined> {
        return this.advanceLead(params, {
            destination:    LeadStatus.CONTACTED,
            activityAction: LEAD_WORKFLOW_ACTIVITY_ACTION.markedContacted,
            statusError:    "invalid_status_for_markContacted",
            extraGate:      (lead, languageCode) => {
                if (!hasContact(lead)) {
                    throw apiValidationException("lead_contact_required", "", null, languageCode);
                }
            },
        });
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      leadTransitionFormSchema,
    })
    async qualify(params: Record<string, any>): Promise<LeadData | undefined> {
        return this.advanceLead(params, {
            destination:    LeadStatus.QUALIFIED,
            activityAction: LEAD_WORKFLOW_ACTIVITY_ACTION.qualified,
            statusError:    "invalid_status_for_qualify",
            extraGate:      (lead, languageCode) => {
                if (!hasContact(lead)) {
                    throw apiValidationException("lead_contact_required", "", null, languageCode);
                }
            },
        });
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      leadTransitionFormSchema,
    })
    async markProposal(params: Record<string, any>): Promise<LeadData | undefined> {
        return this.advanceLead(params, {
            destination:    LeadStatus.PROPOSAL,
            activityAction: LEAD_WORKFLOW_ACTIVITY_ACTION.markedProposal,
            statusError:    "invalid_status_for_markProposal",
            extraGate:      (lead, languageCode) => {
                if (!hasQualifyFacts(lead) || (STATUS_RANK[lead.status] ?? -1) < STATUS_RANK[LeadStatus.QUALIFIED]) {
                    throw apiValidationException("invalid_status_for_markProposal", "", null, languageCode);
                }
            },
        });
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      leadTransitionFormSchema,
    })
    async markNegotiation(params: Record<string, any>): Promise<LeadData | undefined> {
        return this.advanceLead(params, {
            destination:    LeadStatus.NEGOTIATION,
            activityAction: LEAD_WORKFLOW_ACTIVITY_ACTION.markedNegotiation,
            statusError:    "invalid_status_for_markNegotiation",
            extraGate:      (lead, languageCode) => {
                if (!hasQualifyFacts(lead) || (STATUS_RANK[lead.status] ?? -1) < STATUS_RANK[LeadStatus.PROPOSAL]) {
                    throw apiValidationException("invalid_status_for_markNegotiation", "", null, languageCode);
                }
            },
        });
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      closeLeadFormSchema,
    })
    async closeLead(params: Record<string, any>): Promise<LeadData | undefined> {
        const {
            logger, languageCode, session, actionUserCtx, company, _id, outcome, notes, lostReason,
        } = params as TransitionParams & {outcome: LeadCloseOutcome; notes?: string; lostReason?: string};

        logger.start(`Closing lead ${_id} as ${outcome}...`);

        const lead = await leadService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (!isOpen(lead.status)) {
            throw apiValidationException(
                outcome === "won" ? "invalid_status_for_markWon" : "invalid_status_for_markLost",
                "",
                null,
                languageCode,
            );
        }

        if (outcome === "won") {
            if (!hasContact(lead)) {
                throw apiValidationException("lead_contact_required", "", null, languageCode);
            }

            await leadService.updateByIdOrThrow(
                lead._id,
                {
                    $set: {
                        status:      LeadStatus.WON,
                        convertedAt: new Date(),
                    },
                    $push: {
                        activityLog: this.activityEntry(
                            actionUserCtx.userId,
                            LEAD_WORKFLOW_ACTIVITY_ACTION.markedWon,
                            notes,
                        ),
                    },
                },
                {session, logger, languageCode, actionUserCtx},
            );
        } else {
            const reason = lostReason?.trim() ?? "";
            await leadService.updateByIdOrThrow(
                lead._id,
                {
                    $set: {
                        status:     LeadStatus.LOST,
                        lostReason: reason,
                    },
                    $push: {
                        activityLog: this.activityEntry(
                            actionUserCtx.userId,
                            LEAD_WORKFLOW_ACTIVITY_ACTION.markedLost,
                            joinActivityNotes(reason, notes),
                        ),
                    },
                },
                {session, logger, languageCode, actionUserCtx},
            );
        }

        const returnData = await this.reloadLeadDto(lead._id, params);
        logger.finish(`Closed lead ${_id} as ${outcome}`);
        return returnData;
    }

    @action({
        auth:        "private",
        rateLimit:   {windowMs: 60000, max: 30},
        transaction: true,
        schema:      leadTransitionFormSchema,
    })
    async reopen(params: Record<string, any>): Promise<LeadData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params as TransitionParams & {notes?: string};

        logger.start(`Reopening lead ${_id}...`);

        const lead = await leadService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (lead.status !== LeadStatus.LOST) {
            throw apiValidationException("invalid_status_for_reopen", "", null, languageCode);
        }

        await leadService.updateByIdOrThrow(
            lead._id,
            {
                $set: {
                    status:     LeadStatus.CONTACTED,
                    lostReason: "",
                },
                $push: {
                    activityLog: this.activityEntry(
                        actionUserCtx.userId,
                        LEAD_WORKFLOW_ACTIVITY_ACTION.reopened,
                        joinActivityNotes(
                            lead.lostReason ? `Lost reason: ${lead.lostReason}` : undefined,
                            notes,
                        ),
                    ),
                },
            },
            {session, logger, languageCode, actionUserCtx},
        );

        const returnData = await this.reloadLeadDto(lead._id, params);
        logger.finish(`Reopened lead ${_id}`);
        return returnData;
    }

    private async advanceLead(
        params: Record<string, any>,
        options: {
            destination: LeadStatus;
            activityAction: string;
            statusError: string;
            extraGate?: (lead: ILead, languageCode: string) => void;
        },
    ): Promise<LeadData | undefined> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params as TransitionParams & {notes?: string};
        const {destination, activityAction, statusError, extraGate} = options;

        logger.start(`Moving lead ${_id} to ${destination}...`);

        const lead = await leadService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (!canAdvanceTo(lead.status, destination)) {
            throw apiValidationException(statusError, "", null, languageCode);
        }
        extraGate?.(lead, languageCode);

        await leadService.updateByIdOrThrow(
            lead._id,
            {
                $set:  {status: destination},
                $push: {activityLog: this.activityEntry(actionUserCtx.userId, activityAction, notes)},
            },
            {session, logger, languageCode, actionUserCtx},
        );

        const returnData = await this.reloadLeadDto(lead._id, params);
        logger.finish(`Moved lead ${_id} to ${destination}`);
        return returnData;
    }

    private activityEntry(userId: string, action: string, notes?: string) {
        return {
            action,
            notes:       joinActivityNotes(notes),
            performedBy: new ObjectId(userId),
            performedAt: new Date(),
        };
    }

    private async reloadLeadDto(leadId: ObjectId, params: Record<string, any>): Promise<LeadData | undefined> {
        const {logger, languageCode, session, actionUserCtx} = params;
        try {
            const readFields = SchemaGuard.sanitizeFields(
                Lead,
                getModelCollectedData("leads").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            const populate = SchemaGuard.generatePopulate(readFields, Lead.schema);
            const updated = await leadService.findById(
                leadId,
                {session, logger, languageCode},
                populate.populate,
                populate.select,
            );
            if (updated) return leadToDTO(updated);
        } catch {
            logger.debug("User has no read permission on lead after workflow action");
        }
        return undefined;
    }
}
