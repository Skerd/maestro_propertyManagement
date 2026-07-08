import {Schema} from "mongoose";

export function applyLeaseIndexes(LeaseSchema: Schema): void {
    LeaseSchema.index({company: 1, unit:   1, status: 1});
    LeaseSchema.index({company: 1, tenant: 1, status: 1});
    LeaseSchema.index({company: 1, status: 1, endDate: 1});
    LeaseSchema.index({company: 1, startDate: 1});
    // At most one active lease per unit (soft-deleted rows excluded).
    LeaseSchema.index(
        {company: 1, unit: 1},
        {
            unique: true,
            partialFilterExpression: {status: "active", deletedAt: null},
        },
    );
}
