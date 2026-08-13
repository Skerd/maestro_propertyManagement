/**
 * Public chat — visitor self-identification.
 *
 * The widget's "leave your details" form. Sits in propertyManagement rather than
 * alongside the other `/api/public/chat` routes because it creates a CRM `Lead`,
 * which is a propertyManagement concept; core owns the conversation, this module
 * owns what the conversation is worth.
 *
 * Authenticated by the same visitor token as the rest of the public chat, so the
 * details always attach to the conversation the visitor is actually in.
 *
 * @module f_endpoints/propertyManagement/realEstate/public/publicChatIdentify
 */

import {Router} from "express";
import authMW, {NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import visitorAuthMW, {VisitorAuthenticatedMWType} from "@coreModule/utilities/middlewares/visitorAuthMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {
    publicChatIdentifyFormSchema,
    PublicChatIdentifyFormType,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/publicChatIdentify/publicChatIdentify.form.validator";
import {
    PublicChatIdentifyFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/publicChatIdentify/publicChatIdentify.form.response.type";
import {assertPublicChatOpen} from "@coreModule/domain/publicChat/visitorSession";
import {capturePublicChatLead} from "../../../domain/publicChat/capturePublicChatLead";

const router = Router();

type PublicChatIdentifyParams = NotAuthenticatedMWType & VisitorAuthenticatedMWType & PublicChatIdentifyFormType;

router.post(
    "/identify",
    authMW("public"),
    // Tighter than the chat itself: a visitor identifies themselves once or twice,
    // never in a loop.
    rateLimiter({windowMs: 60000, max: 5}),
    visitorAuthMW(),
    validateFormZod(publicChatIdentifyFormSchema),
    asyncHandler(publicChatIdentify),
);

async function publicChatIdentify(
    params: PublicChatIdentifyParams,
): Promise<PublicChatIdentifyFormResponseType> {
    const {
        languageCode,
        logger,
        visitorChannel,
        visitorCompany,
        name,
        email,
        phone,
        note,
        budget,
        budgetCurrency,
    } = params;
    logger.start(`Capturing visitor details for public chat ${visitorChannel._id.toString()}...`);

    assertPublicChatOpen(visitorChannel, languageCode);

    const result = await capturePublicChatLead({
        channel: visitorChannel,
        companyId: visitorCompany._id,
        name,
        email,
        phone,
        note,
        budget,
        budgetCurrency,
        languageCode,
        logger,
    });

    logger.finish(`Lead ${result.created ? "created" : "updated"}: ${result.leadId}`);
    return {ok: true, created: result.created};
}

export const basePath = "/api/realEstate/publicChat";
module.exports = {router, basePath};
