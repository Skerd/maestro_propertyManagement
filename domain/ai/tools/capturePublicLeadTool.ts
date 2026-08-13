/**
 * `capture_lead` — records a website visitor's contact details as a CRM lead.
 *
 * This is the commercial point of the public chat: a pleasant conversation that
 * leaves no trace is worth little. When a visitor volunteers their name and a way
 * to reach them, the bot records it and the sales team picks it up from the
 * normal leads board with `source: chat`.
 *
 * PUBLIC-ONLY, and deliberately so. The internal assistant has `search_leads`
 * for reading the CRM; letting it write leads from a colleague's chat would be a
 * different feature with different consent implications.
 *
 * CONSENT: the model is instructed to call this only with details the visitor
 * volunteered for the purpose of being contacted — never scraped from something
 * they typed in passing.
 *
 * @module capturePublicLeadTool
 */

import {ObjectId} from "mongodb";
import {z} from "zod";
import {registerAssistantTool} from "@coreModule/domain/ai/tools/toolRegistry";
import type {AssistantTool, AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {channelService} from "@coreModule/database/schemas/channel/channel.service";
import {capturePublicChatLead} from "@propertyManagement/domain/publicChat/capturePublicChatLead";

const CaptureLeadArgs = z
    .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(200).optional(),
        phone: z.string().trim().min(4).max(40).optional(),
        note: z.string().trim().max(500).optional(),
    })
    .strip()
    .refine(args => args.email != null || args.phone != null, {
        message: "Provide at least an email address or a phone number.",
    });

const parameters = {
    type: "object" as const,
    properties: {
        name: {
            type: "string",
            description: "The visitor's name, exactly as they gave it.",
        },
        email: {
            type: "string",
            description: "The visitor's email address, if they gave one.",
        },
        phone: {
            type: "string",
            description: "The visitor's phone number, if they gave one.",
        },
        note: {
            type: "string",
            description:
                "One line on what they are looking for, e.g. \"two-bedroom with sea view, " +
                "budget around 200k\".",
        },
    },
    required: ["name"] as string[],
};

async function execute(rawArgs: unknown, ctx: AssistantToolContext): Promise<unknown> {
    const args = CaptureLeadArgs.parse(rawArgs ?? {});

    // The conversation comes from the trusted context, never from the model.
    const channel = await channelService.findOne(
        {
            _id: new ObjectId(ctx.channelId),
            company: new ObjectId(ctx.companyId),
            isPublicChat: true,
        },
        {logger: ctx.logger, languageCode: ctx.languageCode},
    );

    if (!channel) {
        return {saved: false, reason: "This conversation cannot record contact details."};
    }

    const result = await capturePublicChatLead({
        channel,
        companyId: new ObjectId(ctx.companyId),
        name: args.name,
        email: args.email,
        phone: args.phone,
        note: args.note,
        languageCode: ctx.languageCode,
        logger: ctx.logger,
    });

    return {
        saved: true,
        updatedExisting: !result.created,
        message:
            "Their details are saved and the team will follow up. Thank them, and " +
            "carry on helping with whatever they were asking about.",
    };
}

export const capturePublicLeadTool: AssistantTool = {
    name: "capture_lead",
    audience: "public",
    description:
        "Save a visitor's contact details so the team can follow up. Call this ONLY " +
        "when the visitor has given you their name together with an email address or " +
        "phone number and wants to be contacted — for example after they ask to be " +
        "sent a brochure, book a viewing, or be called back. Never guess or invent " +
        "contact details, and do not call this for someone who has not offered them.",
    parameters,
    execute,
};

/** Registered by the core tool bootstrap (registerAllAssistantTools). */
export function registerPublicLeadAssistantTools(): void {
    registerAssistantTool(capturePublicLeadTool);
}
