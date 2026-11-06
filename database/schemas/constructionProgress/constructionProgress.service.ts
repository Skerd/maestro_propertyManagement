import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ConstructionProgress, {IConstructionProgress} from "./constructionProgress";
import type {ClientSession, FilterQuery} from "mongoose";
import type {ObjectId} from "mongodb";

export class ConstructionProgressService extends BaseCrudService<IConstructionProgress, typeof ConstructionProgress> {
    constructor() {
        super(ConstructionProgress, "ConstructionProgress");
    }

    /** The latest report among those matching (by update date). */
    findLatest(filter: FilterQuery<IConstructionProgress>, session: ClientSession | null | undefined) {
        return this.model.findOne(filter)
            .sort({updateDate: -1, createdAt: -1})
            .session(session ?? null);
    }

    /** A report with its project and building names, as a plain object. */
    findWithProjectAndEdificeLean(id: ObjectId) {
        return this.model.findById(id)
            .populate([{path: "project", select: "name"}, {path: "edifice", select: "name"}])
            .lean();
    }
}

export const constructionProgressService = new ConstructionProgressService();
