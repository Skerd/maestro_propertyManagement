import {ObjectId} from "mongodb";

/**
 * The building picker's filter: floor, unit and PD forms post the picked `project`, so the list holds only that
 * project's buildings; without one (or with a malformed id) every building of the company is offered.
 */
export function edificeSelectFilter({project}: {project?: unknown}): {project?: ObjectId} {
    return project && ObjectId.isValid(String(project)) ? {project: new ObjectId(String(project))} : {};
}
