import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import type {HandoverPackage} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.dto";
import type {Sale} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.dto";
import type {IHandoverPackage} from "../../database/schemas/handoverPackage/handoverPackage";
import type {ISale} from "../../database/schemas/sale/sale";
import {handoverPackageService} from "../../database/schemas/handoverPackage/handoverPackage.service";
import {saleService} from "../../database/schemas/sale/sale.service";
import {unitService} from "../../database/schemas/unit/unit.service";
import {propertyManagementConfigService} from "../../database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {handoverPackageToDTO} from "../mappers/handoverPackage/handoverPackageMapper.dto";
import {saleToDTO} from "../mappers/sale/saleMapper.dto";

export type HandoverChecklistItem = {
    _id?: ObjectId | string;
    name?: string;
    description?: string;
    instructions?: string;
    importance?: string;
    completed?: boolean;
    completedAt?: Date;
    completedBy?: ObjectId;
};

type CrudCtx = {
    session?: unknown;
    logger: unknown;
    languageCode: string;
};

function crudOpts(ctx: CrudCtx) {
    return {session: ctx.session, logger: ctx.logger, languageCode: ctx.languageCode};
}

function refId(value: {_id?: unknown} | string | ObjectId | undefined | null): string | undefined {
    if (value == null) return undefined;
    if (typeof value === "string") return value;
    if (value instanceof ObjectId) return value.toString();
    if (typeof value === "object" && value._id != null) return String(value._id);
    return undefined;
}

export function computeHandoverPackageStatus(items: {completed?: boolean}[]): "draft" | "in_progress" | "completed" {
    const n = items.length;
    if (n === 0) return "draft";
    const done = items.filter((item) => item.completed).length;
    if (done === 0) return "draft";
    if (done === n) return "completed";
    return "in_progress";
}

export function mergeHandoverItems(
    existing: HandoverChecklistItem[],
    incoming: HandoverChecklistItem[],
): HandoverChecklistItem[] {
    const remaining = existing.map((item) => ({item, used: false}));
    return incoming.map((row) => {
        const match = remaining.find((entry) => !entry.used && entry.item.name === row.name);
        if (match) match.used = true;
        return {
            name: row.name,
            description: row.description,
            instructions: row.instructions,
            importance: row.importance,
            completed: match?.item.completed ?? false,
            completedAt: match?.item.completedAt,
            completedBy: match?.item.completedBy,
        };
    });
}

function plainHandoverItem(item: HandoverChecklistItem): HandoverChecklistItem {
    const raw = typeof (item as {toObject?: () => HandoverChecklistItem}).toObject === "function"
        ? (item as {toObject: () => HandoverChecklistItem}).toObject()
        : item;
    return {
        _id: raw._id,
        name: raw.name,
        description: raw.description,
        instructions: raw.instructions,
        importance: raw.importance,
        completed: !!raw.completed,
        completedAt: raw.completedAt,
        completedBy: raw.completedBy,
    };
}

export function applyHandoverItemPatches(
    existing: HandoverChecklistItem[],
    patches: {_id: string; completed: boolean}[],
    userId: string,
): HandoverChecklistItem[] {
    const next = existing.map((item) => plainHandoverItem(item));
    for (const patch of patches) {
        const target = next.find((item) => item._id != null && String(item._id) === patch._id);
        if (!target) continue;
        if (patch.completed && !target.completed) {
            target.completed = true;
            target.completedAt = new Date();
            target.completedBy = new ObjectId(userId);
        } else if (!patch.completed && target.completed) {
            target.completed = false;
            target.completedAt = undefined;
            target.completedBy = undefined;
        }
    }
    return next;
}

export async function findSaleForUnit(
    unitId: ObjectId,
    companyId: ObjectId,
    ctx: CrudCtx,
) {
    return saleService.findOne({unit: unitId, company: companyId}, crudOpts(ctx));
}

export async function findPackageForUnit(
    unitId: ObjectId,
    companyId: ObjectId,
    ctx: CrudCtx,
) {
    return handoverPackageService.findOne({unit: unitId, company: companyId}, crudOpts(ctx));
}

export async function assertUnitSoldAndTitleNotTransferred(
    unitId: string,
    companyId: ObjectId,
    ctx: CrudCtx,
) {
    const foundUnit = await unitService.findOneOrThrow(
        {_id: new ObjectId(unitId), company: companyId},
        crudOpts(ctx),
        [{path: "floor", populate: {path: "edifice"}}],
    );
    if (foundUnit.status !== UnitStatus.SOLD) {
        throw apiValidationException("handover_package_unit_not_sold", "", null, ctx.languageCode);
    }
    const sale = await findSaleForUnit(foundUnit._id as ObjectId, companyId, ctx);
    if (sale?.titleTransferDate) {
        throw apiValidationException("handover_package_title_already_transferred", "", null, ctx.languageCode);
    }
    return {foundUnit, sale};
}

export async function assertNoExistingPackageForUnit(
    unitId: ObjectId,
    companyId: ObjectId,
    ctx: CrudCtx,
    excludePackageId?: ObjectId,
) {
    const existing = await handoverPackageService.findOne(
        {
            unit: unitId,
            company: companyId,
            ...(excludePackageId ? {_id: {$ne: excludePackageId}} : {}),
        },
        crudOpts(ctx),
    );
    if (existing) {
        throw apiValidationException("handover_package_already_exists_for_unit", "", null, ctx.languageCode);
    }
}

export async function assertPackageMutableForUnit(
    unitId: ObjectId | string,
    companyId: ObjectId,
    ctx: CrudCtx,
) {
    const sale = await findSaleForUnit(new ObjectId(unitId.toString()), companyId, ctx);
    if (sale?.titleTransferDate) {
        throw apiValidationException("handover_package_title_already_transferred", "", null, ctx.languageCode);
    }
    return sale;
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
    const unitId = sale.unit?._id ?? sale.unit;
    const pkg = unitId
        ? await findPackageForUnit(new ObjectId(unitId.toString()), companyId, ctx)
        : null;
    if (!pkg) {
        throw apiValidationException("sale_title_transfer_package_required", "", null, ctx.languageCode);
    }
    const status = pkg.status === "ready" ? "in_progress" : pkg.status;
    if (status !== "completed") {
        throw apiValidationException("sale_title_transfer_package_in_progress", "", null, ctx.languageCode);
    }
}

export async function salesWithHandoverContext(
    sales: ISale[],
    params: Record<string, any>,
): Promise<Sale[]> {
    const {company} = params;
    const ctx = crudOpts(params);
    const settings = await propertyManagementConfigService.getSettingsForCompany(company._id, ctx);
    const unitIds = sales
        .map((sale) => refId(sale.unit))
        .filter((id): id is string => !!id)
        .map((id) => new ObjectId(id));
    const packages = unitIds.length
        ? await handoverPackageService.find({unit: {$in: unitIds}, company: company._id}, ctx)
        : [];
    const byUnit = new Map(
        packages.map((pkg) => [refId(pkg.unit), pkg] as const).filter(([id]) => !!id),
    );
    return sales.map((sale) => {
        const dto = saleToDTO(sale);
        const pkg = dto.unit?._id ? byUnit.get(dto.unit._id) : undefined;
        return {
            ...dto,
            handoverPackage: pkg ? handoverPackageToDTO(pkg) : undefined,
            requiresHandoverPackageForHandover: settings.requiresHandoverPackageForHandover,
        };
    });
}

export async function packagesWithTitleTransferFlag(
    docs: IHandoverPackage[],
    params: Record<string, any>,
): Promise<HandoverPackage[]> {
    const {company} = params;
    const ctx = crudOpts(params);
    const unitIds = docs
        .map((doc) => refId(doc.unit))
        .filter((id): id is string => !!id)
        .map((id) => new ObjectId(id));
    const sales = unitIds.length
        ? await saleService.find({unit: {$in: unitIds}, company: company._id}, ctx)
        : [];
    const transferred = new Set(
        sales
            .filter((sale) => !!sale.titleTransferDate)
            .map((sale) => refId(sale.unit))
            .filter((id): id is string => !!id),
    );
    return docs.map((doc) => {
        const dto = handoverPackageToDTO(doc);
        return {
            ...dto,
            titleTransferred: dto.unit?._id ? transferred.has(dto.unit._id) : false,
        };
    });
}
