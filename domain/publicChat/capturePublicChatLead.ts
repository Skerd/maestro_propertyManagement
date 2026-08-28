/**
 * Turning a public chat into a CRM lead.
 *
 * Lives in propertyManagement because `Lead` is a propertyManagement concept and
 * core must never import module code — core owns the conversation, this module
 * owns what the conversation is worth commercially.
 *
 * Shared by the two ways a visitor can identify themselves: filling in the
 * widget's form (`/api/realEstate/publicChat/identify`) and simply telling the
 * bot their details, which the `capture_lead` tool picks up.
 *
 * @module propertyManagement/publicChat/capturePublicChatLead
 */

import {Decimal128, ObjectId} from "mongodb";
import {UpdateQuery} from "mongoose";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {channelService} from "@coreModule/database/schemas/channel/channel.service";
import {IChannel} from "@coreModule/database/schemas/channel/channel";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {leadService} from "@propertyManagement/database/schemas/lead/lead.service";
import {LeadSource, LeadStatus} from "@propertyManagement/database/schemas/lead/lead";

export interface CapturePublicChatLeadParams {
    channel: IChannel;
    companyId: ObjectId;
    name: string;
    email?: string;
    phone?: string;
    /** What they said they were after; stored on the lead as notes. */
    note?: string;
    budget?: number;
    /** Company Currency `_id` from the public currencies list. */
    budgetCurrency?: string;
    languageCode?: string;
    logger?: serverLogger;
}

export interface CapturePublicChatLeadResult {
    leadId: string;
    /** False when the conversation already had a lead and we updated it instead. */
    created: boolean;
}

/**
 * Create (or update) the lead behind a public conversation and link the two.
 *
 * Idempotent per conversation: a chat has at most ONE lead. If the visitor gives
 * their details twice — once to the form, once to the bot — the second call
 * enriches the existing lead rather than creating a duplicate in the CRM.
 */
async function resolveBudgetCurrencyId(
    companyId: ObjectId,
    currencyId: string | undefined,
    opts: {logger?: serverLogger; languageCode?: string},
): Promise<ObjectId | undefined> {
    if (!currencyId || !ObjectId.isValid(currencyId)) return undefined;
    const id = new ObjectId(currencyId);
    const currency =
        (await currencyService.findOne({_id: id, company: companyId}, opts))
        ?? (await currencyService.findOne({_id: id}, opts));
    return currency?._id as ObjectId | undefined;
}

function buildLeadCommercialFields(params: {
    note?: string;
    budget?: number;
    budgetCurrencyId?: ObjectId;
}) {
    const {note, budget, budgetCurrencyId} = params;
    return {
        ...(note ? {notes: note.trim()} : {}),
        ...(budget != null && Number.isFinite(budget)
            ? {budget: Decimal128.fromString(String(budget))}
            : {}),
        ...(budgetCurrencyId ? {budgetCurrency: budgetCurrencyId} : {}),
    };
}

export async function capturePublicChatLead(
    params: CapturePublicChatLeadParams,
): Promise<CapturePublicChatLeadResult> {
    const {channel, companyId, name, email, phone, note, budget, budgetCurrency, languageCode, logger} = params;
    const opts = {logger, languageCode};

    const trimmedName = name.trim();
    const spaceIndex = trimmedName.indexOf(" ");
    const firstName = spaceIndex > 0 ? trimmedName.slice(0, spaceIndex) : trimmedName;
    const lastName = spaceIndex > 0 ? trimmedName.slice(spaceIndex + 1).trim() : undefined;

    const context = channel.publicChat?.context;
    const existingLeadId = channel.publicChat?.lead;
    const budgetCurrencyId = await resolveBudgetCurrencyId(companyId, budgetCurrency, opts);
    const commercial = buildLeadCommercialFields({note, budget, budgetCurrencyId});

    // Enrich rather than duplicate.
    if (existingLeadId) {
        await leadService.updateById(
            new ObjectId(existingLeadId.toString()),
            {
                firstName,
                ...(lastName ? {lastName} : {}),
                ...(email ? {email: email.trim().toLowerCase()} : {}),
                ...(phone ? {phone: phone.trim()} : {}),
                ...commercial,
                chat: channel._id,
            },
            opts,
        );
        return {leadId: existingLeadId.toString(), created: false};
    }

    const lead = await leadService.create(
        {
            //@ts-ignore
            company: companyId,
            firstName,
            ...(lastName ? {lastName} : {}),
            ...(email ? {email: email.trim().toLowerCase()} : {}),
            ...(phone ? {phone: phone.trim()} : {}),
            ...commercial,
            // Carry what they were browsing straight onto the lead, so the agent
            // sees the interest without reading the transcript.
            ...(context?.project ? {projectInterest: context.project} : {}),
            ...(context?.unit ? {unitInterest: context.unit} : {}),
            status: LeadStatus.NEW,
            source: LeadSource.CHAT,
            chat: channel._id,
        },
        opts,
    );

    // Link both ways: the conversation knows its lead, and the visitor block
    // carries the details so the inbox can label the row without a join.
    await channelService.updateById(
        channel._id,
        {
            $set: {
                "publicChat.lead": lead._id,
                "publicChat.visitor.displayName": trimmedName,
                ...(email ? {"publicChat.visitor.email": email.trim().toLowerCase()} : {}),
                ...(phone ? {"publicChat.visitor.phone": phone.trim()} : {}),
            },
        } as unknown as UpdateQuery<IChannel>,
        opts,
    );

    logger?.debug(`Captured lead ${lead._id.toString()} from public chat ${channel._id.toString()}`);
    return {leadId: lead._id.toString(), created: true};
}
