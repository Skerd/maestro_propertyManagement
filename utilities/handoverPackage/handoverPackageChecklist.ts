import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {HandoverPackage} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.dto";
import type {Sale} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.dto";
import type {IHandoverPackage} from "../../database/schemas/handoverPackage/handoverPackage";
import type {ISale, ISaleHandoverChecklistItem} from "../../database/schemas/sale/sale";
import {handoverPackageService} from "../../database/schemas/handoverPackage/handoverPackage.service";
import {saleService} from "../../database/schemas/sale/sale.service";
import {unitService} from "../../database/schemas/unit/unit.service";
import {floorService} from "../../database/schemas/floor/floor.service";
import {edificeService} from "../../database/schemas/edifice/edifice.service";
import {projectService} from "../../database/schemas/project/project.service";
import {propertyManagementConfigService} from "../../database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {handoverPackageToDTO} from "../mappers/handoverPackage/handoverPackageMapper.dto";
import {saleToDTO} from "../mappers/sale/saleMapper.dto";
import {
    applyHandoverItemPatches,
    checklistRowsChanged,
    concatenateEffectiveItems,
    configHasLegacyCompletion,
    idString,
    isHandoverChecklistComplete,
    mergeSaleHandoverChecklist,
    seedChecklistFromLegacyConfigItems,
    type ResolvedHandoverConfigs,
    type SaleHandoverChecklistRow,
} from "./handoverPackageChecklist.sync";

export {
    applyHandoverItemPatches,
    concatenateEffectiveItems,
    isHandoverChecklistComplete,
    mergeSaleHandoverChecklist,
    seedChecklistFromLegacyConfigItems,
};

type CrudCtx = {
    session?: ClientSession;
    logger: unknown;
    languageCode: string;
};

function crudOpts(ctx: CrudCtx) {
    return {session: ctx.session, logger: ctx.logger as never, languageCode: ctx.languageCode};
}

function asObjectId(value: unknown): ObjectId | undefined {
    const s = idString(value);
    return s != null ? new ObjectId(s) : undefined;
}

const unsetRef = {$in: [null, undefined]};

function scopeUnset(field: "edifice" | "floor" | "unit"): Record<string, unknown> {
    return {$or: [{[field]: {$exists: false}}, {[field]: null}]};
}

export async function resolveHandoverConfigsForUnit(
    unitId: ObjectId,
    companyId: ObjectId,
    ctx: CrudCtx,
): Promise<{configs: ResolvedHandoverConfigs; packages: IHandoverPackage[]}> {
    const foundUnit = await unitService.findOneOrThrow(
        {_id: unitId, company: companyId},
        crudOpts(ctx),
    );
    const projectId = asObjectId(foundUnit.project);
    const edificeId = asObjectId(foundUnit.edifice);
    const floorId = asObjectId(foundUnit.floor);
    const [projectPkg, edificePkg, floorPkg, unitPkg] = await Promise.all([
        projectId
            ? handoverPackageService.findOne({
                company: companyId,
                project: projectId,
                ...{},
                $and: [scopeUnset("edifice"), scopeUnset("floor"), scopeUnset("unit")],
            }, crudOpts(ctx))
            : Promise.resolve(null),
        edificeId
            ? handoverPackageService.findOne({
                company: companyId,
                edifice: edificeId,
                $and: [scopeUnset("floor"), scopeUnset("unit")],
            }, crudOpts(ctx))
            : Promise.resolve(null),
        floorId
            ? handoverPackageService.findOne({
                company: companyId,
                floor: floorId,
                $and: [scopeUnset("unit")],
            }, crudOpts(ctx))
            : Promise.resolve(null),
        handoverPackageService.findOne({company: companyId, unit: unitId}, crudOpts(ctx)),
    ]);
    const packages = [projectPkg, edificePkg, floorPkg, unitPkg].filter((pkg): pkg is IHandoverPackage => pkg != null);
    return {
        configs: {project: projectPkg, edifice: edificePkg, floor: floorPkg, unit: unitPkg},
        packages,
    };
}

export function toChecklistRows(items: ISaleHandoverChecklistItem[] | undefined): SaleHandoverChecklistRow[] {
    return (items ?? []).map((item) => ({
        _id: asObjectId(item._id),
        sourcePackageId: asObjectId(item.sourcePackageId),
        sourceItemId: asObjectId(item.sourceItemId),
        sourceScope: item.sourceScope === "project" || item.sourceScope === "edifice" || item.sourceScope === "floor" || item.sourceScope === "unit" || item.sourceScope === "retained"
            ? item.sourceScope
            : undefined,
        name: item.name,
        description: item.description,
        instructions: item.instructions,
        importance: item.importance,
        completed: item.completed,
        completedAt: item.completedAt,
        completedBy: asObjectId(item.completedBy),
        retained: item.retained,
    }));
}

async function stripLegacyCompletionFromConfigs(configs: ResolvedHandoverConfigs, ctx: CrudCtx) {
    for (const pkg of [configs.project, configs.edifice, configs.floor, configs.unit]) {
        if (!pkg?._id || !configHasLegacyCompletion({project: pkg})) continue;
        const items = (pkg.items ?? []).map((item) => ({
            _id: item._id,
            name: item.name,
            description: item.description,
            instructions: item.instructions,
            importance: item.importance,
        }));
        await handoverPackageService.updateByIdOrThrow(
            pkg._id,
            {$set: {items}, $unset: {status: 1}},
            crudOpts(ctx),
        );
    }
}

export async function syncSaleHandoverChecklist(
    sale: ISale,
    companyId: ObjectId,
    ctx: CrudCtx,
): Promise<{sale: ISale; configs: IHandoverPackage[]; complete: boolean}> {
    const unitId = asObjectId(sale.unit);
    if (!unitId) {
        return {sale, configs: [], complete: false};
    }
    const resolved = await resolveHandoverConfigsForUnit(unitId, companyId, ctx);
    if (sale.titleTransferDate) {
        return {
            sale,
            configs: resolved.packages,
            complete: isHandoverChecklistComplete(sale.handoverChecklistItems ?? [], resolved.packages.length > 0),
        };
    }

    let existing = toChecklistRows(sale.handoverChecklistItems);
    if (existing.length === 0) {
        existing = seedChecklistFromLegacyConfigItems(resolved.configs);
    }
    const live = concatenateEffectiveItems(resolved.configs);
    const next = mergeSaleHandoverChecklist(existing, live);
    if (checklistRowsChanged(existing, next)) {
        await saleService.updateByIdOrThrow(
            sale._id,
            {$set: {handoverChecklistItems: next}},
            crudOpts(ctx),
        );
        sale.handoverChecklistItems = next.map((row) => ({
            ...row,
            name: row.name ?? "",
        }));
    }
    if (configHasLegacyCompletion(resolved.configs)) {
        await stripLegacyCompletionFromConfigs(resolved.configs, ctx);
    }
    return {
        sale,
        configs: resolved.packages,
        complete: isHandoverChecklistComplete(next, resolved.packages.length > 0),
    };
}

export async function findSaleForUnit(unitId: ObjectId, companyId: ObjectId, ctx: CrudCtx) {
    return saleService.findOne({unit: unitId, company: companyId}, crudOpts(ctx));
}

export async function assertHandoverPackageScopeAvailable(
    companyId: ObjectId,
    scope: {project: ObjectId; edifice: ObjectId | null; floor: ObjectId | null; unit: ObjectId | null},
    ctx: CrudCtx,
    excludePackageId?: ObjectId,
) {
    const query: Record<string, unknown> = {
        company: companyId,
        ...(excludePackageId ? {_id: {$ne: excludePackageId}} : {}),
    };
    if (scope.unit) {
        query.unit = scope.unit;
    } else if (scope.floor) {
        query.floor = scope.floor;
        query.$and = [scopeUnset("unit")];
    } else if (scope.edifice) {
        query.edifice = scope.edifice;
        query.$and = [scopeUnset("floor"), scopeUnset("unit")];
    } else {
        query.project = scope.project;
        query.$and = [scopeUnset("edifice"), scopeUnset("floor"), scopeUnset("unit")];
    }
    const existing = await handoverPackageService.findOne(query, crudOpts(ctx));
    if (existing) {
        throw apiValidationException("handover_package_already_exists_for_scope", "", null, ctx.languageCode);
    }
}

export async function resolveAndFillHandoverPackageScope(
    data: {project?: unknown; edifice?: unknown; floor?: unknown; unit?: unknown},
    companyId: ObjectId,
    ctx: CrudCtx,
) {
    const opts = crudOpts(ctx);
    const unitId = asObjectId(data.unit);
    if (unitId) {
        const foundUnit = await unitService.findOneOrThrow({_id: unitId, company: companyId}, opts);
        const project = asObjectId(foundUnit.project);
        const edifice = asObjectId(foundUnit.edifice);
        const floor = asObjectId(foundUnit.floor);
        if (!project || !edifice || !floor) {
            throw apiValidationException("handover_package_ancestry_mismatch", "", null, ctx.languageCode);
        }
        return {project, edifice, floor, unit: foundUnit._id as ObjectId};
    }
    const floorId = asObjectId(data.floor);
    if (floorId) {
        const foundFloor = await floorService.findOneOrThrow({_id: floorId, company: companyId}, opts);
        const project = asObjectId(foundFloor.project);
        const edifice = asObjectId(foundFloor.edifice);
        if (!project || !edifice) {
            throw apiValidationException("handover_package_ancestry_mismatch", "", null, ctx.languageCode);
        }
        return {project, edifice, floor: foundFloor._id as ObjectId, unit: null};
    }
    const edificeId = asObjectId(data.edifice);
    if (edificeId) {
        const foundEdifice = await edificeService.findOneOrThrow({_id: edificeId, company: companyId}, opts);
        const project = asObjectId(foundEdifice.project);
        if (!project) {
            throw apiValidationException("handover_package_ancestry_mismatch", "", null, ctx.languageCode);
        }
        return {project, edifice: foundEdifice._id as ObjectId, floor: null, unit: null};
    }
    const projectId = asObjectId(data.project);
    if (!projectId) {
        throw apiValidationException("handover_package_ancestry_mismatch", "", null, ctx.languageCode);
    }
    await projectService.findOneOrThrow({_id: projectId, company: companyId}, opts);
    return {project: projectId, edifice: null, floor: null, unit: null};
}

export async function assertTitleTransferAllowed(
    sale: ISale,
    companyId: ObjectId,
    ctx: CrudCtx,
) {
    if (sale.titleTransferDate) {
        throw apiValidationException("sale_title_transfer_already_recorded", "", null, ctx.languageCode);
    }
    const settings = await propertyManagementConfigService.getSettingsForCompany(
        companyId,
        crudOpts(ctx),
    );
    if (!settings.requiresHandoverPackageForHandover) return;
    const synced = await syncSaleHandoverChecklist(sale, companyId, ctx);
    if (synced.configs.length === 0) {
        throw apiValidationException("sale_title_transfer_package_required", "", null, ctx.languageCode);
    }
    if (!synced.complete) {
        throw apiValidationException("sale_title_transfer_package_in_progress", "", null, ctx.languageCode);
    }
}

export async function salesWithHandoverContext(
    sales: ISale[],
    params: Record<string, any>,
): Promise<Sale[]> {
    const {company, session, logger, languageCode} = params;
    const ctx = crudOpts({session, logger, languageCode});
    const settings = await propertyManagementConfigService.getSettingsForCompany(company._id, ctx);
    const enriched: Sale[] = [];
    for (const sale of sales) {
        const synced = await syncSaleHandoverChecklist(sale, company._id, ctx);
        const dto = saleToDTO(synced.sale);
        enriched.push({
            ...dto,
            handoverConfigs: synced.configs.map(handoverPackageToDTO),
            handoverChecklistComplete: synced.complete,
            requiresHandoverPackageForHandover: settings.requiresHandoverPackageForHandover,
        });
    }
    return enriched;
}

export function packagesToDTO(docs: IHandoverPackage[]): HandoverPackage[] {
    return docs.map(handoverPackageToDTO);
}
