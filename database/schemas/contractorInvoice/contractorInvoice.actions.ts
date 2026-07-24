import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitForApprovalContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/submitForApprovalContractorInvoice.form.validator";
import {approveContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/approveContractorInvoice.form.validator";
import {rejectContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/rejectContractorInvoice.form.validator";
import {markPaidContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/markPaidContractorInvoice.form.validator";
import {disputeContractorInvoiceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/disputeContractorInvoice.form.validator";
import ContractorInvoice from "./contractorInvoice";
import {contractorInvoiceService} from "./contractorInvoice.service";
import {contractorInvoiceToDTO} from "@propertyManagement/utilities/mappers/contractorInvoice/contractorInvoiceMapper.dto";

async function transition(params: Record<string, any>, label: string, allowedFrom: string[], next: string): Promise<any> {
    const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
    logger.start(`ContractorInvoice.${label} ` + String(_id) + `...`);
    const existing = await contractorInvoiceService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
    if (!allowedFrom.includes(existing.status ?? "received")) {
        throw apiValidationException(`invalid_status_for_${label}`, "", null, languageCode);
    }
    const $set: Record<string, any> = {status: next};
    if (notes !== undefined && notes !== null && String(notes).trim()) {
        const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
        const n = String(notes).trim();
        $set.notes = prev ? (prev + "\n-----\n" + n) : n;
    }
    await contractorInvoiceService.updateByIdOrThrow(existing._id, {$set}, {session, logger, languageCode, auditUserId: actionUserCtx.userId});
    try {
        const populate = SchemaGuard.generatePopulate(getModelCollectedData("contractorinvoices").readFields!, ContractorInvoice.schema);
        const updated = await contractorInvoiceService.findById(existing._id, {session, logger, languageCode}, populate.populate);
        if (updated) return contractorInvoiceToDTO(updated);
    } catch { /* no read */ }
    logger.finish(`ContractorInvoice.${label} done`);
    return undefined;
}

export class ContractorInvoiceActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: submitForApprovalContractorInvoiceFormSchema})
    async submitForApproval(params: Record<string, any>): Promise<any> {
        return transition(params, "submitForApproval", ["received"], "under_review");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveContractorInvoiceFormSchema})
    async approve(params: Record<string, any>): Promise<any> {
        return transition(params, "approve", ["under_review"], "approved");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: rejectContractorInvoiceFormSchema})
    async reject(params: Record<string, any>): Promise<any> {
        return transition(params, "reject", ["received", "under_review"], "rejected");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: markPaidContractorInvoiceFormSchema})
    async markPaid(params: Record<string, any>): Promise<any> {
        return transition(params, "markPaid", ["approved"], "paid");
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: disputeContractorInvoiceFormSchema})
    async dispute(params: Record<string, any>): Promise<any> {
        return transition(params, "dispute", ["received", "under_review", "approved"], "disputed");
    }
}
