import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Lead, {ILead} from "./lead";
import type {FilterQuery} from "mongoose";
import type {ObjectId} from "mongodb";

export class LeadService extends BaseCrudService<ILead, typeof Lead> {
    constructor() {
        super(Lead, "Lead");
    }

    /** The matching leads' email and names, as plain objects. */
    findContactsLean(filter: FilterQuery<ILead>) {
        return this.model.find(filter)
            .select("_id email firstName lastName")
            .lean<{_id: ObjectId; email?: string; firstName?: string; lastName?: string}[]>();
    }

    /** The matching lead's id, as a plain object. */
    findIdLean(filter: FilterQuery<ILead>) {
        return this.model.findOne(filter).select("_id").lean<{_id: ObjectId}>();
    }
}

export const leadService = new LeadService();
