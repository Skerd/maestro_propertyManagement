import {ObjectId} from "mongodb";

type UnitSelectScope = {project?: ObjectId; edifice?: ObjectId; floor?: ObjectId};

/**
 * The unit picker's scope: PM and PD forms post the picked `project`, `edifice` and `floor`, so the list holds only
 * their units; a missing or malformed id leaves that level open (the route always keeps the company's units only).
 */
export function unitSelectFilter(params: {project?: unknown; edifice?: unknown; floor?: unknown}): UnitSelectScope {
    const scope: UnitSelectScope = {};
    for (const key of ["project", "edifice", "floor"] as const) {
        const raw = params[key];
        if (raw && ObjectId.isValid(String(raw))) scope[key] = new ObjectId(String(raw));
    }
    return scope;
}
