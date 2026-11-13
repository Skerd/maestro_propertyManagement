/**
 * The buildings each contractor works on, for its sheet's Buildings group (TD-B199): one query for the whole page,
 * read only when the caller's role can read buildings, with the caller's field grants (SEC-09).
 */

import type {ObjectId} from "mongodb";
import {readableListFetch} from "@coreModule/database/security/readableListFetch";
import type {UserContext} from "@coreModule/utilities/types/types";
import Edifice, {type IEdifice} from "@propertyManagement/database/schemas/edifice/edifice";
import {edificeService} from "@propertyManagement/database/schemas/edifice/edifice.service";

type ConstructorEdificesCtx = {companyId: ObjectId; actionUserCtx: UserContext; languageCode: string};

/** Contractor id → its buildings by name; empty when the role cannot read buildings. */
export async function edificesByConstructor(constructorIds: ObjectId[], ctx: ConstructorEdificesCtx): Promise<Map<string, IEdifice[]>> {
    const byConstructor = new Map<string, IEdifice[]>();
    const fetch = readableListFetch(Edifice, ctx);
    if (!fetch || constructorIds.length === 0) return byConstructor;

    // `constructors` only groups the rows here; the sheet shows each building's name (EdificeSnippet).
    const select = fetch.select ? `${fetch.select} constructors` : undefined;
    const edifices = await edificeService.find(
        {company: ctx.companyId, deletedAt: null, constructors: {$in: constructorIds}},
        {languageCode: ctx.languageCode},
        undefined,
        select,
        {name: 1},
    );
    const wanted = new Set(constructorIds.map(String));
    for (const edifice of edifices) {
        for (const constructorId of edifice.constructors ?? []) {
            const key = String(constructorId);
            if (!wanted.has(key)) continue;
            const list = byConstructor.get(key) ?? [];
            list.push(edifice);
            byConstructor.set(key, list);
        }
    }
    return byConstructor;
}
