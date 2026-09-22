import {ObjectId} from "mongodb";
import type {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {unitService} from "../../database/schemas/unit/unit.service";

export type HubScopeParams = {
    project?: string;
    edifice?: string;
    floor?: string;
    unit?: string;
    /** The authenticated company document, as authMW puts it on the body. */
    company: AuthenticatedMWType["company"];
    logger: any;
    languageCode: string;
};

/**
 * Turn a hub's project/edifice/floor/unit filters into the unit ids they cover,
 * always scoped to the caller's company.
 *
 * Returns `undefined` when no hierarchy filter is set (meaning "don't restrict"),
 * and an empty array when the filter matches nothing, so callers return no rows
 * rather than every row.
 */
export async function resolveHubUnitIds(params: HubScopeParams): Promise<ObjectId[] | undefined> {
    const {project, edifice, floor, unit, company, logger, languageCode} = params;
    const opts = {logger, languageCode, withDeleted: false as const};

    if (unit && ObjectId.isValid(unit)) {
        const foundUnit = await unitService.findOne(
            {_id: new ObjectId(unit), company: company._id},
            opts as Parameters<typeof unitService.findOne>[1],
        );
        // Unknown / cross-company unit → empty match set (no throw; list returns empty).
        return foundUnit?._id ? [foundUnit._id as ObjectId] : [];
    }

    const unitScope: Record<string, unknown> = {company: company._id};
    if (project && ObjectId.isValid(project)) unitScope.project = new ObjectId(String(project));
    if (edifice && ObjectId.isValid(edifice)) unitScope.edifice = new ObjectId(String(edifice));
    if (floor && ObjectId.isValid(floor)) unitScope.floor = new ObjectId(String(floor));
    if (!unitScope.project && !unitScope.edifice && !unitScope.floor) return undefined;

    const units = await unitService.find(
        unitScope,
        opts as Parameters<typeof unitService.find>[1],
        [],
        "_id",
        {},
        10_000,
        0,
    );
    return units.map((u) => u._id as ObjectId);
}
