import {Schema} from "mongoose";

export function applyLeadIndexes(LeadSchema: Schema): void {
    LeadSchema.index({company: 1, status: 1, createdAt: -1});
    LeadSchema.index({company: 1, assignedTo: 1, createdAt: -1});
    LeadSchema.index({company: 1, projectInterest: 1, createdAt: -1});
    LeadSchema.index({company: 1, source: 1, createdAt: -1});
    LeadSchema.index({company: 1, followUpDate: 1});
    LeadSchema.index({company: 1, firstName: 1, lastName: 1});
}
