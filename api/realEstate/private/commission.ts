import {ObjectId} from "mongodb";
import {z} from "zod";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {commissionService} from "../../../database/schemas/commission/commission.service";
import Commission from "../../../database/schemas/commission/commission";
import {CommissionActions} from "../../../database/schemas/commission/commission.actions";
import {commissionsToDTO, commissionToDTO} from "../../../utilities/mappers/commission/commissionMapper.dto";
import {commissionFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/commission/commission.form.validator";
import {unitService} from "../../../database/schemas/unit/unit.service";
import {saleService} from "../../../database/schemas/sale/sale.service";
import {reservationService} from "../../../database/schemas/reservation/reservation.service";

export const basePath = "/api/realEstate/commission";

async function commissionExtraListFilter(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {unit, project, edifice, floor, company, logger, languageCode} = params as {
        unit?: string;
        project?: string;
        edifice?: string;
        floor?: string;
        company: {_id: ObjectId};
        logger: unknown;
        languageCode: string;
    };
    const opts = {logger, languageCode, withDeleted: false as const};

    let unitIds: ObjectId[] | undefined;

    if (unit && ObjectId.isValid(unit)) {
        const foundUnit = await unitService.findOneOrThrow(
            {_id: new ObjectId(unit), company: company._id},
            opts as Parameters<typeof unitService.findOneOrThrow>[1],
        );
        unitIds = [foundUnit._id as ObjectId];
    } else {
        const unitScope: Record<string, unknown> = {company: company._id};
        if (project && ObjectId.isValid(project)) unitScope.project = new ObjectId(String(project));
        if (edifice && ObjectId.isValid(edifice)) unitScope.edifice = new ObjectId(String(edifice));
        if (floor && ObjectId.isValid(floor)) unitScope.floor = new ObjectId(String(floor));
        if (unitScope.project || unitScope.edifice || unitScope.floor) {
            const units = await unitService.find(
                unitScope,
                opts as Parameters<typeof unitService.find>[1],
                undefined,
                "_id",
            );
            unitIds = units.map((u) => u._id as ObjectId);
        }
    }

    if (!unitIds) return {};
    if (unitIds.length === 0) {
        return {_id: {$in: []}};
    }

    const [sales, reservations] = await Promise.all([
        saleService.find(
            {company: company._id, unit: {$in: unitIds}},
            opts as Parameters<typeof saleService.find>[1],
            undefined,
            "_id",
        ),
        reservationService.find(
            {company: company._id, unit: {$in: unitIds}},
            opts as Parameters<typeof reservationService.find>[1],
            undefined,
            "_id",
        ),
    ]);

    const saleIds = sales.map((s) => s._id);
    const reservationIds = reservations.map((r) => r._id);

    if (saleIds.length === 0 && reservationIds.length === 0) {
        return {_id: {$in: []}};
    }

    return {
        $or: [
            ...(saleIds.length > 0 ? [{sale: {$in: saleIds}}] : []),
            ...(reservationIds.length > 0 ? [{reservation: {$in: reservationIds}}] : []),
        ],
    };
}

// Commissions are system-generated; no user-facing create/edit/delete/restore.
// - create/delete/restore: blocked by "no-permission" in schema model permissions.
// - edit: blocked by schemaSanitizer (all fields write: "no-permission"); buildUpdateData is a no-op for any edge case.
export const {router} = createCrudRouter({
    collectionName: "commissions",
    model: Commission,
    service: commissionService,
    listSchema: commissionFormSchema,
    extraListFilter: commissionExtraListFilter,
    createSchema: () => z.looseObject({}),
    editSchema: () => z.looseObject({_id: z.string()}),
    toDTO: commissionToDTO,
    toDTOArray: commissionsToDTO,
    toSelect: () => [],
    buildCreateData: () => ({}),
    buildUpdateData: () => ({}),
    defaultSort: {createdAt: -1},
    actions: CommissionActions,
});
