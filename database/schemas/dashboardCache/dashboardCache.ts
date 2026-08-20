import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";

export interface IDashboardCache extends Document {
    cacheKey: string;
    company: any;
    result: any;
    computedAt: Date;
}

const DashboardCacheSchema = new Schema<IDashboardCache>(
    {
        cacheKey: {type: SchemaTypes.String, required: true, unique: true, index: true},
        company: {type: SchemaTypes.ObjectId, required: true, index: true},
        result: {type: SchemaTypes.Mixed, required: true},
        computedAt: {type: SchemaTypes.Date, required: true, default: Date.now, index: {expireAfterSeconds: 3600}},
    },
    {timestamps: false},
);

const DashboardCache = model<IDashboardCache>("DashboardCache", DashboardCacheSchema);
normalizeSchemaPermissions(DashboardCache);
export default DashboardCache;
