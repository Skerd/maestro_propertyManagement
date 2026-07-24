import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import dayjs from "dayjs";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {runOcrIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/runOcrIncomingInvoice.form.validator";
import {classifyIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/classifyIncomingInvoice.form.validator";
import {routeIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/routeIncomingInvoice.form.validator";
import {rejectIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/rejectIncomingInvoice.form.validator";
import {postIncomingInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/incomingInvoice/postIncomingInvoice.form.validator";
import IncomingInvoice from "./incomingInvoice";
import ContractorInvoice from "../contractorInvoice/contractorInvoice";
import {incomingInvoiceService} from "./incomingInvoice.service";
import {incomingInvoiceToDTO} from "@propertyManagement/utilities/mappers/incomingInvoice/incomingInvoiceMapper.dto";
import {extractIncomingInvoice} from "@propertyManagement/utilities/ap/ocrExtract";

async function reload(id: any, ctx: any) {
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("incominginvoices").readFields!, IncomingInvoice.schema);
        const updated = await incomingInvoiceService.findById(id, ctx, populate.populate);
        if (updated) return incomingInvoiceToDTO(updated);
    } catch { /* no read */ }
    return undefined;
}

export class IncomingInvoiceActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: runOcrIncomingInvoiceFormSchema})
    async runOcr(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, qrPayload} = params;
        const existing = await incomingInvoiceService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        const result = extractIncomingInvoice({qrPayload});
        const $set: Record<string, any> = {ocrStatus: result.ocrStatus};
        if (result.ocrStatus === "done") {
            const d = result.data;
            if (d.creditorName) $set.extractedSupplierName = d.creditorName;
            if (d.iban) $set.extractedIban = d.iban;
            if (d.amount != null) $set.extractedAmount = d.amount;
            if (d.currency) $set.extractedCurrencyCode = d.currency;
            if (d.reference) $set.extractedQrReference = d.reference;
            if ((d as any).invoiceNumber) $set.extractedInvoiceNumber = (d as any).invoiceNumber;
        }
        await incomingInvoiceService.updateByIdOrThrow(existing._id, {$set}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: classifyIncomingInvoiceFormSchema})
    async classify(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await incomingInvoiceService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (!["inbox"].includes(existing.status ?? "inbox")) {
            throw apiValidationException("invalid_status_for_classify", "", null, languageCode);
        }
        if (!existing.matchedConstructor) {
            throw apiValidationException("classify_requires_matched_constructor", "", null, languageCode);
        }
        await incomingInvoiceService.updateByIdOrThrow(existing._id, {$set: {status: "classified"}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: routeIncomingInvoiceFormSchema})
    async route(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await incomingInvoiceService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (!["classified"].includes(existing.status ?? "inbox")) {
            throw apiValidationException("invalid_status_for_route", "", null, languageCode);
        }
        await incomingInvoiceService.updateByIdOrThrow(existing._id, {$set: {status: "routed"}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectIncomingInvoiceFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await incomingInvoiceService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (["posted", "rejected"].includes(existing.status ?? "inbox")) {
            throw apiValidationException("invalid_status_for_reject", "", null, languageCode);
        }
        await incomingInvoiceService.updateByIdOrThrow(existing._id, {$set: {status: "rejected"}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 20}, transaction: true, schema: postIncomingInvoiceFormSchema})
    async post(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        const existing = await incomingInvoiceService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        if (!["routed"].includes(existing.status ?? "inbox")) {
            throw apiValidationException("invalid_status_for_post", "", null, languageCode);
        }
        if (!existing.project) throw apiValidationException("post_requires_project", "", null, languageCode);
        if (!existing.matchedConstructor) throw apiValidationException("post_requires_matched_constructor", "", null, languageCode);
        if (!existing.currency) throw apiValidationException("post_requires_currency", "", null, languageCode);

        const date = dayjs().format("YYYYMMDD");
        const [created] = await ContractorInvoice.create([{
            name: `CINV-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            project: existing.project,
            constructorRef: existing.matchedConstructor,
            constructionContract: existing.matchedContract ?? undefined,
            invoiceNumber: existing.extractedInvoiceNumber ?? undefined,
            invoiceDate: existing.extractedInvoiceDate ?? undefined,
            dueDate: existing.extractedDueDate ?? undefined,
            grossAmount: existing.extractedAmount ?? undefined,
            bkpAccountCode: existing.bkpAccountCode ?? undefined,
            qrBillReference: existing.extractedQrReference ?? undefined,
            source: "ap_inbox",
            currency: existing.currency,
            status: "received",
            company: company._id,
            createdBy: actionUserCtx.userId,
        }], {session});

        await incomingInvoiceService.updateByIdOrThrow(existing._id, {$set: {status: "posted", createdContractorInvoice: created._id}}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
        return reload(existing._id, {session, logger, languageCode});
    }
}
