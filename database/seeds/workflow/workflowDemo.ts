import {createHash} from "crypto";
import type {HydratedDocument, Model} from "mongoose";
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

/**
 * The fixed `_id` of a workflow demo record: the company id's time bytes plus a hash of model, company and seed key.
 * The id is the seed key's home, so re-runs find the record again while `name` stays the code the pre-validate hook
 * generates (a seed key there showed as the record's code, TD-B206).
 */
export function demoRecordId(modelName: string, companyId: ObjectId, seedKey: string): ObjectId {
    const hash = createHash("sha256").update(`${PM_DEMO_PREFIX}:${modelName}:${companyId.toString()}:${seedKey}`).digest("hex");
    return new ObjectId(companyId.toString().slice(0, 8) + hash.slice(0, 16));
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
 * Upserts a workflow demo record on its fixed id ({@link demoRecordId}). `name` is left out, so a new record gets
 * its generated code and an existing one keeps it.
 */
export async function upsertDemoRecord<T>(
    Model: Model<T>,
    company: ICompany,
    seedKey: string,
    payload: Record<string, unknown>,
    logger: serverLogger,
    label: string,
): Promise<HydratedDocument<T> | null> {
    const _id = demoRecordId(Model.modelName, company._id, seedKey);
    try {
        const body = {
            ...payload,
            company: company._id,
            createdBy: company.createdBy,
        };
        const existing = await Model.findById(_id);
        if (existing) {
            existing.set(body);
            await existing.save();
            return existing;
        }
        return await Model.create({_id, ...body});
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.err(`Error creating ${label} '${seedKey}': ${message}`);
        return null;
    }
}
