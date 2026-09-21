import {ObjectId} from "mongodb";
import {projectService} from "../../database/schemas/project/project.service";
import {edificeService} from "../../database/schemas/edifice/edifice.service";
import {floorService} from "../../database/schemas/floor/floor.service";
import {buildPriceOnRequestScope, type PriceOnRequestScope} from "./priceOnRequest.util";

/**
 * Resolves a company's "show price on request" scope, expanded down the hierarchy:
 * flagged projects → their edifices (plus directly flagged edifices) → their floors
 * (plus directly flagged floors). Three small indexed queries on `{company, showPriceOnRequest}`.
 */
export async function loadPriceOnRequestScope(companyId: ObjectId): Promise<PriceOnRequestScope> {
    const base = {company: companyId, deletedAt: null};

    const flaggedProjects = await projectService.find({...base, showPriceOnRequest: true}, {}, undefined, "_id");
    const projectIds = flaggedProjects.map((project) => project._id);

    const edifices = await edificeService.find(
        {
            ...base,
            $or: [
                {showPriceOnRequest: true},
                ...(projectIds.length > 0 ? [{project: {$in: projectIds}}] : []),
            ],
        },
        {},
        undefined,
        "_id",
    );
    const edificeIds = edifices.map((edifice) => edifice._id);

    const floors = await floorService.find(
        {
            ...base,
            $or: [
                {showPriceOnRequest: true},
                ...(edificeIds.length > 0 ? [{edifice: {$in: edificeIds}}] : []),
            ],
        },
        {},
        undefined,
        "_id",
    );

    return buildPriceOnRequestScope(edificeIds, floors.map((floor) => floor._id));
}
