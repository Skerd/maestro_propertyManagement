import {Schema} from "mongoose";

export function applyCommissionIndexes(CommissionSchema: Schema): void {
    CommissionSchema.index({company: 1, agent: 1, status: 1, createdAt: -1});
    CommissionSchema.index({company: 1, sourceType: 1, sourceId: 1}, {unique: true});
}
