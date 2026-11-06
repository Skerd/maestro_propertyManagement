import type {FilterQuery, UpdateQuery} from "mongoose";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import DashboardCache, {IDashboardCache} from "./dashboardCache";

export class DashboardCacheService extends BaseCrudService<IDashboardCache, typeof DashboardCache> {
    constructor() {
        super(DashboardCache, "DashboardCache");
    }

    /** A cached dashboard result by its key, as a plain object. */
    findByKey(cacheKey: string) {
        return this.model.findOne({cacheKey}).lean();
    }

    /** Writes (or replaces) a cached dashboard result. */
    store(filter: FilterQuery<IDashboardCache>, update: UpdateQuery<IDashboardCache>) {
        return this.model.findOneAndUpdate(filter, update, {upsert: true, new: true});
    }
}

export const dashboardCacheService = new DashboardCacheService();
