import {ObjectId} from "mongodb";
import Constructor from "@propertyManagement/database/schemas/constructor/constructor";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import type {OperationsRefs} from "@propertyManagement/database/seeds/operations/operationsRefs";

export const PM_DEMO_PREFIX = "pm-demo";

export const GARDA_PROJECT_ID = "6a50368bd2892db79d54cd54";
export const GARDA_EDIFICE_ID = "6a5036fcd2892db79d54d3b4";
export const ARIA_PROJECT_ID = "6a4f94ae99511ee1e0efb78a";
export const ARIA_EDIFICE_ID = "6a5015619874ae8d17645c66";
export const SOLD_UNIT_ID = "6a501e2588c85ab8284360f5";
export const BUILDER_VAT = "VAT001234567";
export const BUILDER2_VAT = "VAT002345678";

export function pmDemoName(seedKey: string): string {
    return `${PM_DEMO_PREFIX}:${seedKey}`;
}

export type WorkflowCtx = {
    company: ICompany;
    refs: OperationsRefs;
    projectIds: Map<string, ObjectId>;
    edificeIds: Map<string, ObjectId>;
    unitIds: Map<string, ObjectId>;
    constructorByVat: Map<string, ObjectId>;
};

export async function loadWorkflowCtx(
    company: ICompany,
    refs: OperationsRefs,
    projectIds: Map<string, ObjectId>,
    edificeIds: Map<string, ObjectId>,
    unitIds: Map<string, ObjectId>,
): Promise<WorkflowCtx> {
    const constructors = await Constructor.find({company: company._id})
        .select("_id vat")
        .lean();
    return {
        company,
        refs,
        projectIds,
        edificeIds,
        unitIds,
        constructorByVat: new Map(
            (constructors as { _id: ObjectId; vat?: string }[]).map((c) => [String(c.vat), c._id]),
        ),
    };
}

export function garda(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.projectIds.get(GARDA_PROJECT_ID);
}

export function gardaEdifice(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.edificeIds.get(GARDA_EDIFICE_ID);
}

export function aria(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.projectIds.get(ARIA_PROJECT_ID);
}

export function ariaEdifice(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.edificeIds.get(ARIA_EDIFICE_ID);
}

export function soldUnit(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.unitIds.get(SOLD_UNIT_ID);
}

export function builder(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.constructorByVat.get(BUILDER_VAT);
}

export function builder2(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.constructorByVat.get(BUILDER2_VAT);
}

export function eur(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.refs.currencyByCode.get("EUR");
}

export function echo(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.refs.userByUsername.get("echo@echo.com");
}

export function almir(ctx: WorkflowCtx): ObjectId | undefined {
    return ctx.refs.userByUsername.get("almir@leka.com");
}

/**
 * Upsert on the stable `pm-demo:<key>` name. `name` is unique (globally or per
 * company) on every workflow schema, and the pre-validate hook only mints a
 * date-suffixed code when name is empty — so we always set it.
 */
export async function upsertByName<T extends {name?: string; set: (p: object) => void; save: () => Promise<unknown>}>(
    Model: {findOne: (q: object) => Promise<T | null>; create: (p: object) => Promise<T>},
    company: ICompany,
    name: string,
    payload: Record<string, unknown>,
    logger: serverLogger,
    label: string,
): Promise<T | null> {
    try {
        const body = {
            ...payload,
            name,
            company: company._id,
            createdBy: company.createdBy,
        };
        let existing = await Model.findOne({name});
        if (!existing) {
            existing = await Model.findOne({company: company._id, name});
        }
        if (existing) {
            existing.set(body);
            await existing.save();
        } else {
            existing = await Model.create(body);
        }
        return existing;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.err(`Error creating ${label} '${name}': ${message}`);
        return null;
    }
}
