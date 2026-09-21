import {ObjectId} from "mongodb";
import type {EffectivePriceVisibility} from "armonia/src/modules/propertyManagement/api/realEstate/private/priceVisibility.constants";
import {projectService} from "../../database/schemas/project/project.service";
import {edificeService} from "../../database/schemas/edifice/edifice.service";
import {floorService} from "../../database/schemas/floor/floor.service";
import {
    buildPriceOnRequestScope,
    refId,
    resolvePriceVisibility,
    type PriceOnRequestScope,
} from "./priceOnRequest.util";

const EXPLICIT_VISIBILITY = {$in: ["hide", "show"]};

/**
 * Resolves a company's public price visibility scope. Only records that carry a decision are
 * loaded: explicitly set projects → edifices with an explicit choice or in a decided project →
 * floors with an explicit choice or in a decided edifice. Three small indexed queries on
 * `{company, priceVisibility}` (+ the parent refs).
 */
export async function loadPriceOnRequestScope(companyId: ObjectId): Promise<PriceOnRequestScope> {
    const base = {company: companyId, deletedAt: null};

    const projects = await projectService.find(
        {...base, priceVisibility: EXPLICIT_VISIBILITY},
        {},
        undefined,
        "_id priceVisibility",
    );
    const projectIds = projects.map((project) => project._id);

    const edifices = await edificeService.find(
        {
            ...base,
            $or: [
                {priceVisibility: EXPLICIT_VISIBILITY},
                ...(projectIds.length > 0 ? [{project: {$in: projectIds}}] : []),
            ],
        },
        {},
        undefined,
        "_id project priceVisibility",
    );
    // Every loaded edifice has a decision (its own or its project's), so its floors inherit one.
    const edificeIds = edifices.map((edifice) => edifice._id);

    const floors = await floorService.find(
        {
            ...base,
            $or: [
                {priceVisibility: EXPLICIT_VISIBILITY},
                ...(edificeIds.length > 0 ? [{edifice: {$in: edificeIds}}] : []),
            ],
        },
        {},
        undefined,
        "_id edifice priceVisibility",
    );

    return buildPriceOnRequestScope({projects, edifices, floors});
}

type ChainOptions = {companyId: ObjectId; logger?: any; languageCode?: string};

async function loadProjectVisibility(projectRef: unknown, opts: ChainOptions) {
    const projectId = refId(projectRef);
    if (!projectId) return undefined;
    const project = await projectService.findOne(
        {_id: new ObjectId(projectId), company: opts.companyId},
        {logger: opts.logger, languageCode: opts.languageCode},
        undefined,
        "priceVisibility",
    );
    return project?.priceVisibility;
}

async function loadEdificeChain(edificeRef: unknown, opts: ChainOptions) {
    const edificeId = refId(edificeRef);
    if (!edificeId) return {};
    const edifice = await edificeService.findOne(
        {_id: new ObjectId(edificeId), company: opts.companyId},
        {logger: opts.logger, languageCode: opts.languageCode},
        undefined,
        "project priceVisibility",
    );
    if (!edifice) return {};
    return {edifice: edifice.priceVisibility, project: await loadProjectVisibility(edifice.project, opts)};
}

async function loadFloorChain(floorRef: unknown, opts: ChainOptions) {
    const floorId = refId(floorRef);
    if (!floorId) return {};
    const floor = await floorService.findOne(
        {_id: new ObjectId(floorId), company: opts.companyId},
        {logger: opts.logger, languageCode: opts.languageCode},
        undefined,
        "edifice priceVisibility",
    );
    if (!floor) return {};
    return {floor: floor.priceVisibility, ...(await loadEdificeChain(floor.edifice, opts))};
}

/**
 * Effective public price visibility of one record plus which level decided it — for the
 * private panel ("Inherit → Hidden, from edifice"). Walks the record's parents by ref.
 */
export async function loadEffectivePriceVisibility(
    level: "project" | "edifice" | "floor" | "unit",
    record: {priceVisibility?: unknown; project?: unknown; edifice?: unknown; floor?: unknown},
    opts: ChainOptions,
): Promise<EffectivePriceVisibility> {
    switch (level) {
        case "project":
            return resolvePriceVisibility({project: record.priceVisibility});
        case "edifice":
            return resolvePriceVisibility({
                project: await loadProjectVisibility(record.project, opts),
                edifice: record.priceVisibility,
            });
        case "floor":
            return resolvePriceVisibility({
                ...(await loadEdificeChain(record.edifice, opts)),
                floor: record.priceVisibility,
            });
        case "unit":
            return resolvePriceVisibility({
                ...(await loadFloorChain(record.floor, opts)),
                unit: record.priceVisibility,
            });
    }
}
