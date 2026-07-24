import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {declineTenderInvitationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/declineTenderInvitation.form.validator";
import {withdrawTenderInvitationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/withdrawTenderInvitation.form.validator";
import {resendTenderInvitationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/resendTenderInvitation.form.validator";
import TenderInvitation from "./tenderInvitation";
import {tenderInvitationService} from "./tenderInvitation.service";
import {tenderInvitationToDTO} from "@propertyManagement/utilities/mappers/tenderInvitation/tenderInvitationMapper.dto";

async function reload(existingId: any, ctx: any) {
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("tenderinvitations").readFields!, TenderInvitation.schema);
        const updated = await tenderInvitationService.findById(existingId, ctx, populate.populate);
        if (updated) return tenderInvitationToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

export class TenderInvitationActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: declineTenderInvitationFormSchema})
    async decline(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await tenderInvitationService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (!["invited", "viewing"].includes(existing.status ?? "invited")) {
            throw apiValidationException("invalid_status_for_decline", "", null, languageCode);
        }
        await tenderInvitationService.updateByIdOrThrow(existing._id, {$set: {status: "declined", respondedAt: new Date()}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: withdrawTenderInvitationFormSchema})
    async withdraw(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await tenderInvitationService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (["withdrawn", "declined"].includes(existing.status ?? "invited")) {
            throw apiValidationException("invalid_status_for_withdraw", "", null, languageCode);
        }
        await tenderInvitationService.updateByIdOrThrow(existing._id, {$set: {status: "withdrawn"}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: resendTenderInvitationFormSchema})
    async resend(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await tenderInvitationService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (["withdrawn"].includes(existing.status ?? "invited")) {
            throw apiValidationException("invalid_status_for_resend", "", null, languageCode);
        }
        // Rotate the portal token and reset to invited so the contractor gets a fresh link.
        await tenderInvitationService.updateByIdOrThrow(existing._id, {$set: {status: "invited", invitedAt: new Date(), portalAccessToken: crypto.randomBytes(24).toString("hex")}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }
}
