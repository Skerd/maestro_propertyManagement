/**
 * Unit Service
 *
 * CRUD service for Unit model.
 */

import {ObjectId} from 'mongodb';
import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import SchemaGuard from '@coreModule/database/security/schemaGuard';
import {UserContext} from '@coreModule/utilities/types/types';
import type {EdificeMoneyByCurrency} from 'armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.dto';
import Sale, {SalePaymentType} from '../sale/sale';
import Reservation from '../reservation/reservation';
import {saleService} from '../sale/sale.service';
import {reservationService} from '../reservation/reservation.service';
import {computePaymentPlanPaid, computePaymentPlanRemainingBalance, PaymentPlanStatus} from '../paymentPlan/paymentPlan';
import Unit, {IUnit} from './unit';
import UnitCost from '../unitCost/unitCost';
import {unitCostService} from '../unitCost/unitCost.service';
import {objectIdFromRef, resolveHierarchySetsFromUnitIds} from '../unitCost/unitCostHierarchy.util';
import {
    inheritedUnitCostCountByUnitPipeline,
    inheritedUnitCostMoneyByUnitPipeline,
    inheritedUnitCostShareRows,
    UNIT_COST_DOC_SUBTOTAL_STAGE,
} from '../unitCost/unitCostInheritedPipelines.util';
import type {serverLogger} from '@coreModule/loggers/serverLog';
import type {SanitizedFields} from 'armonia/src/modules/core/types';
import type {UnitStatistics} from 'armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto';
import type {MoneyInput} from 'armonia/src/modules/core/helpers/money';
import {
    addMoney,
    addMoneyLines,
    addMoneyTotals,
    aggregateCurrencyFields,
    type AggregateMoneyLine,
    currencyOfLine,
    moneyRowsOf,
    type MoneyTotals,
} from '../../../utilities/statistics/moneyTotals';
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import type {ClientSession, FilterQuery} from "mongoose";

// SchemaGuard read shape for reservation deposit fields (matches floor/edifice listing stat sanitization).
const RESERVATION_DEPOSIT_READ_SHAPE = {
    depositAmount: {},
    depositCurrency: CurrencySimpleSnippet
} as const;

// SchemaGuard read shape for cash sale collected amounts.
const SALE_CASH_COLLECTED_READ_SHAPE = {
    finalPrice: {},
    saleCurrency: CurrencySimpleSnippet
} as const;

// SchemaGuard read shape for payment-plan sale money fields.
const SALE_PAYMENT_PLAN_MONEY_READ_SHAPE = {
    saleCurrency: CurrencySimpleSnippet,
    paymentType: {},
    paymentPlan: {
        keys: {
            downPayment: {},
            downPaymentPaid: {},
            installments: {},
        },
    },
} as const;

/** UnitCost aggregate stats: need line math + currency + statuses. */
const UNIT_COST_STATS_READ_SHAPE = {
    verificationStatus: {},
    paymentStatus: {},
    currency: CurrencySimpleSnippet,
    expenditureItems: {},
} as const;

// ── Unit statistics, one block per figure (OPT-03) ──────────────────────────────────────────────────────────────

type AggregateStage = Record<string, unknown>;

/** The money one unit's statistics are built from, before the caller's read permissions pick from it. */
type UnitRawStatistics = {
    collectedCash: MoneyTotals;
    collectedPaymentPlan: MoneyTotals;
    collectedReservationDeposits: MoneyTotals;
    notCollectedReservationDeposits: MoneyTotals;
    notCollectedPaymentPlanUnpaid: MoneyTotals;
    verifiedPaidUnitCosts: MoneyTotals;
    verifiedOutstandingUnitCosts: MoneyTotals;
    pendingVerificationUnitCosts: MoneyTotals;
    unitCostDocumentCount: number;
    averagePrice?: AggregateMoneyLine;
};

type UnitMoneyBuckets = Record<Exclude<keyof UnitRawStatistics, 'unitCostDocumentCount' | 'averagePrice'>, Map<string, MoneyTotals>>;

const UNIT_COST_VERIFIED_PAID = {verificationStatus: 'verified', paymentStatus: 'paid'};
const UNIT_COST_VERIFIED_OUTSTANDING = {verificationStatus: 'verified', paymentStatus: {$in: ['unpaid', 'partially_paid', 'disputed']}};
const UNIT_COST_PENDING_VERIFICATION = {verificationStatus: {$in: ['pending_verification', 'needs_revision']}};

/**
 * The shared tail of every money pipeline: look the currency up, add `amount` (a `$toDecimal`, so the sum is exact)
 * per unit and currency, then push one line per currency under `itemsKey`.
 */
function sumByUnitAndCurrency(currencyField: string, amount: unknown, itemsKey: 'collectedByCurrency' | 'unpaidByCurrency'): AggregateStage[] {
    return [
        {$lookup: {from: 'currencies', localField: currencyField, foreignField: '_id', as: 'currencyInfo'}},
        {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
        {
            $group: {
                _id: {unit: '$unit', currency: `$${currencyField}`},
                total: {$sum: amount},
                currencyInfo: {$first: '$currencyInfo'},
            },
        },
        {
            $group: {
                _id: '$_id.unit',
                [itemsKey]: {$push: {currencyId: '$_id.currency', ...aggregateCurrencyFields('currencyInfo'), value: '$total'}},
            },
        },
    ];
}

/** List price per m² (unit area + veranda): one line per unit with its price currency, in Decimal128. */
function pricePerSqmByUnitPipeline(unitIds: ObjectId[]): AggregateStage[] {
    return [
        {$match: {_id: {$in: unitIds}}},
        {
            $addFields: {
                areaForSqm: {$add: [{$toDecimal: {$ifNull: ['$area', 0]}}, {$toDecimal: {$ifNull: ['$verandaArea', 0]}}]},
                priceDecimal: {$toDecimal: {$ifNull: ['$price', 0]}},
            },
        },
        {$lookup: {from: 'currencies', localField: 'priceCurrency', foreignField: '_id', as: 'pc'}},
        {$unwind: {path: '$pc', preserveNullAndEmptyArrays: true}},
        {
            $project: {
                _id: 1,
                value: {$cond: {if: {$gt: ['$areaForSqm', 0]}, then: {$divide: ['$priceDecimal', '$areaForSqm']}, else: 0}},
                currencyId: '$priceCurrency',
                ...aggregateCurrencyFields('pc'),
            },
        },
    ];
}

/** Collected on cash sales: the final price per unit and sale currency. */
function cashSaleCollectedByUnitPipeline(unitIds: ObjectId[]): AggregateStage[] {
    return [
        {$match: {unit: {$in: unitIds}, paymentType: SalePaymentType.CASH}},
        ...sumByUnitAndCurrency('saleCurrency', {$toDecimal: {$ifNull: ['$finalPrice', 0]}}, 'collectedByCurrency'),
    ];
}

/** A payment-plan sale's plan, with the sale's unit and currency (a plan stores none). */
type PaymentPlanSaleRow = AggregateMoneyLine & {
    unit: ObjectId;
    plan: {status?: string; downPayment?: MoneyInput; downPaymentPaid?: boolean; installments?: {amount?: MoneyInput; paidAmount?: MoneyInput; status?: string}[]};
};

/**
 * Payment-plan sales with their live plan and currency. What was collected and what is still owed are computed from
 * the plan by its own money functions, not in the pipeline (TD-B165).
 */
function paymentPlanSalesByUnitPipeline(unitIds: ObjectId[]): AggregateStage[] {
    return [
        {$match: {unit: {$in: unitIds}, paymentType: SalePaymentType.PAYMENT_PLAN, paymentPlan: {$exists: true, $ne: null}}},
        {
            $lookup: {
                from: 'paymentplans',
                localField: 'paymentPlan',
                foreignField: '_id',
                // The soft-delete hook filters only the outer pipeline (DB-04).
                pipeline: [
                    {$match: {deletedAt: null}},
                    {$project: {status: 1, downPayment: 1, downPaymentPaid: 1, 'installments.amount': 1, 'installments.paidAmount': 1, 'installments.status': 1}},
                ],
                as: 'plan',
            },
        },
        {$unwind: '$plan'},
        {$lookup: {from: 'currencies', localField: 'saleCurrency', foreignField: '_id', as: 'currencyInfo'}},
        {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
        {$project: {unit: 1, plan: 1, currencyId: '$saleCurrency', ...aggregateCurrencyFields('currencyInfo')}},
    ];
}

/**
 * Collected on a plan: the down payment once paid plus every installment payment. Not collected: what the plan still
 * owes (the down payment and every installment that is not cancelled, less what was paid); none on a cancelled plan.
 */
function foldPaymentPlanSales(rows: PaymentPlanSaleRow[], collected: Map<string, MoneyTotals>, notCollected: Map<string, MoneyTotals>): void {
    for (const row of rows) {
        const currency = currencyOfLine(row);
        const collectedTotals = collected.get(row.unit.toString());
        const notCollectedTotals = notCollected.get(row.unit.toString());
        if (!currency || !collectedTotals || !notCollectedTotals) continue;
        addMoney(collectedTotals, currency, computePaymentPlanPaid(row.plan));
        if (row.plan.status === PaymentPlanStatus.CANCELLED) continue;
        const owed = computePaymentPlanRemainingBalance(row.plan);
        if (owed > 0) addMoney(notCollectedTotals, currency, owed);
    }
}

/** Active reservations' deposits per unit: paid ones are collected, unpaid ones are not. */
function reservationDepositsByUnitPipeline(unitIds: ObjectId[], paid: boolean): AggregateStage[] {
    return [
        {
            $match: {
                isActive: true,
                paid,
                depositAmount: {$exists: true, $ne: null},
                depositCurrency: {$exists: true, $ne: null},
                unit: {$in: unitIds},
            },
        },
        ...sumByUnitAndCurrency('depositCurrency', {$toDecimal: '$depositAmount'}, paid ? 'collectedByCurrency' : 'unpaidByCurrency'),
    ];
}

/** A unit's own unit costs in one state (`stateMatch`), per currency. */
function unitCostMoneyByUnitPipeline(unitIds: ObjectId[], stateMatch: Record<string, unknown>): AggregateStage[] {
    return [
        {$match: {unit: {$in: unitIds}, ...stateMatch, $or: [{deletedAt: {$exists: false}}, {deletedAt: null}]}},
        UNIT_COST_DOC_SUBTOTAL_STAGE,
        ...sumByUnitAndCurrency('currency', '$docSubtotal', 'collectedByCurrency'),
    ];
}

/** How many unit costs a unit has of its own. */
function unitCostCountByUnitPipeline(unitIds: ObjectId[]): AggregateStage[] {
    return [
        {$match: {unit: {$in: unitIds}, $or: [{deletedAt: {$exists: false}}, {deletedAt: null}]}},
        {$group: {_id: '$unit', count: {$sum: 1}}},
    ];
}

/** Unit costs booked on a unit's floor, edifice or project, shared down to it: paid, outstanding, pending (split by `inheritedUnitCostShareRows`), count. */
async function inheritedUnitCostPipelines(service: UnitService, unitIds: ObjectId[], opts: {logger?: serverLogger; languageCode: string}) {
    const hierarchySets = await resolveHierarchySetsFromUnitIds(unitIds, opts);
    const unitForCompany = await service.findOne({_id: unitIds[0]}, opts, undefined, 'company');
    const companyId = objectIdFromRef((unitForCompany as {_id?: unknown; company?: unknown} | null)?.company);
    const empty: AggregateStage[] = [{$match: {_id: {$in: []}}}];
    if (companyId == null) {
        return {paid: empty, outstanding: empty, pending: empty, count: empty};
    }
    return {
        paid: inheritedUnitCostMoneyByUnitPipeline(companyId, hierarchySets, UNIT_COST_VERIFIED_PAID),
        outstanding: inheritedUnitCostMoneyByUnitPipeline(companyId, hierarchySets, UNIT_COST_VERIFIED_OUTSTANDING),
        pending: inheritedUnitCostMoneyByUnitPipeline(companyId, hierarchySets, UNIT_COST_PENDING_VERIFICATION),
        count: inheritedUnitCostCountByUnitPipeline(companyId, unitIds, hierarchySets),
    };
}

/** Own plus inherited unit cost documents per unit. */
function unitCostDocumentCountsOf(own: {_id?: unknown; count?: number}[], inherited: {_id?: unknown; count?: number}[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of own) {
        const uid = row._id?.toString();
        if (uid != null && uid !== '') counts.set(uid, row.count ?? 0);
    }
    for (const row of inherited) {
        const uid = row._id?.toString();
        if (uid != null && uid !== '') counts.set(uid, (counts.get(uid) ?? 0) + (row.count ?? 0));
    }
    return counts;
}

/** The price-per-m² line of each unit. */
function averagePriceLinesByUnit(rows: (AggregateMoneyLine & {_id?: unknown})[]): Map<string, AggregateMoneyLine> {
    const byUnit = new Map<string, AggregateMoneyLine>();
    for (const row of rows) {
        const uid = row._id?.toString();
        if (uid) byUnit.set(uid, row);
    }
    return byUnit;
}

/** Folds per-unit aggregate lines (`collectedByCurrency` / `unpaidByCurrency`) into each unit's totals. */
function foldUnitMoneyLines(byUnit: Map<string, MoneyTotals>, rows: {_id?: unknown; [items: string]: unknown}[], itemsKey: 'collectedByCurrency' | 'unpaidByCurrency'): void {
    for (const row of rows) {
        const totals = byUnit.get(String(row._id));
        if (totals) addMoneyLines(totals, row[itemsKey] as AggregateMoneyLine[] | undefined);
    }
}

/** Several money totals summed per currency, as statistics rows. */
function summedRows(parts: MoneyTotals[]): EdificeMoneyByCurrency[] {
    const totals: MoneyTotals = new Map();
    for (const part of parts) addMoneyTotals(totals, part);
    return moneyRowsOf(totals);
}

type ReadableUnitStatistics = {
    cashSales: boolean;
    paymentPlanSales: boolean;
    reservationDeposits: boolean;
    unitCostMoney: boolean;
    unitCostCount: boolean;
    pricePerSquareMeter: boolean;
};

/** SchemaGuard's read allowlist for `shape`, or null when it grants nothing (it throws then). */
function readableFields(model: Parameters<typeof SchemaGuard.sanitizeFields>[0], shape: SanitizedFields, actionUserCtx: UserContext, languageCode: string): SanitizedFields | null {
    try {
        return SchemaGuard.sanitizeFields(model, shape, 'read', actionUserCtx, languageCode);
    } catch {
        return null;
    }
}

/** Which statistics blocks the caller may read (SEC-09): each needs every field it is computed from. */
function readableUnitStatistics(actionUserCtx: UserContext, languageCode: string): ReadableUnitStatistics {
    const saleCash = readableFields(Sale, SALE_CASH_COLLECTED_READ_SHAPE, actionUserCtx, languageCode);
    const salePlan = readableFields(Sale, SALE_PAYMENT_PLAN_MONEY_READ_SHAPE, actionUserCtx, languageCode);
    const deposits = readableFields(Reservation, RESERVATION_DEPOSIT_READ_SHAPE, actionUserCtx, languageCode);
    const unitCosts = readableFields(UnitCost, UNIT_COST_STATS_READ_SHAPE, actionUserCtx, languageCode);
    const unitCostUnit = readableFields(UnitCost, {unit: {}}, actionUserCtx, languageCode);
    const unitPriceArea = readableFields(Unit, {price: {}, area: {}}, actionUserCtx, languageCode);
    return {
        cashSales: !!(saleCash?.finalPrice && saleCash?.saleCurrency),
        paymentPlanSales: UnitService.salePaymentPlanMoneyReadable(salePlan),
        reservationDeposits: !!(deposits?.depositAmount && deposits?.depositCurrency),
        unitCostMoney: !!(unitCosts?.verificationStatus && unitCosts?.paymentStatus && unitCosts?.currency && unitCosts?.expenditureItems),
        unitCostCount: !!unitCostUnit?.unit,
        pricePerSquareMeter: !!(unitPriceArea?.price && unitPriceArea?.area),
    };
}

export class UnitService extends BaseCrudService<IUnit, typeof Unit> {
    constructor() {
        super(Unit, 'Unit');
    }

    /** True when SchemaGuard left enough payment-plan keys to read unpaid/collected plan money. */
    static salePaymentPlanMoneyReadable(salePpFields: Record<string, unknown> | null | undefined): boolean {
        if (!salePpFields?.saleCurrency || !salePpFields?.paymentType) return false;
        const pp = salePpFields.paymentPlan as {keys?: Record<string, unknown>} | undefined;
        const k = pp?.keys;
        if (!k) return false;
        return (
            k.downPayment !== undefined &&
            k.downPaymentPaid !== undefined &&
            k.installments !== undefined
        );
    }

    /** Per-unit collected / outstanding money by currency, filtered by `actionUserCtx` read permissions. */
    async calculateStatistics(unitIds: ObjectId[], actionUserCtx: UserContext, languageCode: string, options: {logger?: serverLogger} = {}): Promise<Record<string, UnitStatistics>> {
        const {logger} = options;

        // No units requested — nothing to aggregate or return.
        if (unitIds.length === 0) {
            return {};
        }

        const opts = {logger, languageCode};
        const inheritedPipelines = await inheritedUnitCostPipelines(this, unitIds, opts);

        // Unit listing price plus sale, reservation and unit-cost money aggregations, in parallel.
        const [
            unitAvgPriceRows,
            salesCollectedCashByUnit,
            paymentPlanSales,
            reservationPaidByUnit,
            reservationUnpaidByUnit,
            unitCostVerifiedPaidByUnit,
            unitCostVerifiedOutstandingByUnit,
            unitCostCountByUnit,
            unitCostPendingVerificationByUnit,
            unitCostInheritedVerifiedPaidByUnit,
            unitCostInheritedVerifiedOutstandingByUnit,
            unitCostInheritedPendingByUnit,
            unitCostInheritedCountByUnit,
        ] = await Promise.all([
            this.aggregate(pricePerSqmByUnitPipeline(unitIds), opts),
            saleService.aggregate(cashSaleCollectedByUnitPipeline(unitIds), opts),
            saleService.aggregate(paymentPlanSalesByUnitPipeline(unitIds), opts),
            reservationService.aggregate(reservationDepositsByUnitPipeline(unitIds, true), opts),
            reservationService.aggregate(reservationDepositsByUnitPipeline(unitIds, false), opts),
            unitCostService.aggregate(unitCostMoneyByUnitPipeline(unitIds, UNIT_COST_VERIFIED_PAID), opts),
            unitCostService.aggregate(unitCostMoneyByUnitPipeline(unitIds, UNIT_COST_VERIFIED_OUTSTANDING), opts),
            unitCostService.aggregate(unitCostCountByUnitPipeline(unitIds), opts),
            unitCostService.aggregate(unitCostMoneyByUnitPipeline(unitIds, UNIT_COST_PENDING_VERIFICATION), opts),
            unitCostService.aggregate(inheritedPipelines.paid, opts).then((rows) => inheritedUnitCostShareRows(rows, unitIds)),
            unitCostService.aggregate(inheritedPipelines.outstanding, opts).then((rows) => inheritedUnitCostShareRows(rows, unitIds)),
            unitCostService.aggregate(inheritedPipelines.pending, opts).then((rows) => inheritedUnitCostShareRows(rows, unitIds)),
            unitCostService.aggregate(inheritedPipelines.count, opts),
        ]);

        const unitCostDocumentCounts = unitCostDocumentCountsOf(unitCostCountByUnit, unitCostInheritedCountByUnit);
        const averagePriceByUnitId = averagePriceLinesByUnit(unitAvgPriceRows);

        // Per-unit money buckets, each keyed by currency id; inherited unit costs fold into the unit's own.
        const emptyBucket = () => new Map<string, MoneyTotals>(unitIds.map((unitId) => [unitId.toString(), new Map()]));
        const fold = (rowsList: any[][], itemsKey: 'collectedByCurrency' | 'unpaidByCurrency') => {
            const byUnit = emptyBucket();
            for (const rows of rowsList) foldUnitMoneyLines(byUnit, rows, itemsKey);
            return byUnit;
        };
        const collectedPaymentPlan = emptyBucket();
        const notCollectedPaymentPlanUnpaid = emptyBucket();
        foldPaymentPlanSales(paymentPlanSales, collectedPaymentPlan, notCollectedPaymentPlanUnpaid);
        const buckets: UnitMoneyBuckets = {
            collectedCash: fold([salesCollectedCashByUnit], 'collectedByCurrency'),
            collectedPaymentPlan,
            collectedReservationDeposits: fold([reservationPaidByUnit], 'collectedByCurrency'),
            notCollectedReservationDeposits: fold([reservationUnpaidByUnit], 'unpaidByCurrency'),
            notCollectedPaymentPlanUnpaid,
            verifiedPaidUnitCosts: fold([unitCostVerifiedPaidByUnit, unitCostInheritedVerifiedPaidByUnit], 'collectedByCurrency'),
            verifiedOutstandingUnitCosts: fold([unitCostVerifiedOutstandingByUnit, unitCostInheritedVerifiedOutstandingByUnit], 'collectedByCurrency'),
            pendingVerificationUnitCosts: fold([unitCostPendingVerificationByUnit, unitCostInheritedPendingByUnit], 'collectedByCurrency'),
        };

        // Which statistics the caller may read is the same for every unit: worked out once.
        const readable = readableUnitStatistics(actionUserCtx, languageCode);
        const result: Record<string, UnitStatistics> = {};
        for (const unitId of unitIds) {
            const key = unitId.toString();
            const money = (bucket: keyof UnitMoneyBuckets): MoneyTotals => buckets[bucket].get(key) ?? new Map();
            result[key] = UnitService.unitStatisticsOf({
                collectedCash: money('collectedCash'),
                collectedPaymentPlan: money('collectedPaymentPlan'),
                collectedReservationDeposits: money('collectedReservationDeposits'),
                notCollectedReservationDeposits: money('notCollectedReservationDeposits'),
                notCollectedPaymentPlanUnpaid: money('notCollectedPaymentPlanUnpaid'),
                verifiedPaidUnitCosts: money('verifiedPaidUnitCosts'),
                verifiedOutstandingUnitCosts: money('verifiedOutstandingUnitCosts'),
                pendingVerificationUnitCosts: money('pendingVerificationUnitCosts'),
                unitCostDocumentCount: unitCostDocumentCounts.get(key) ?? 0,
                averagePrice: averagePriceByUnitId.get(key),
            }, readable);
        }
        return result;
    }

    /** One unit's statistics: each money block only when the caller may read the fields it comes from. */
    private static unitStatisticsOf(raw: UnitRawStatistics, readable: ReadableUnitStatistics): UnitStatistics {
        const out: UnitStatistics = {};

        const collected = summedRows([
            ...(readable.cashSales ? [raw.collectedCash] : []),
            ...(readable.paymentPlanSales ? [raw.collectedPaymentPlan] : []),
            ...(readable.reservationDeposits ? [raw.collectedReservationDeposits] : []),
        ]);
        if (collected.length > 0) {
            out.collectedAmount = collected;
        }
        out.notCollectedAmount = summedRows([
            ...(readable.reservationDeposits ? [raw.notCollectedReservationDeposits] : []),
            ...(readable.paymentPlanSales ? [raw.notCollectedPaymentPlanUnpaid] : []),
        ]);

        if (readable.unitCostMoney) {
            const paid = moneyRowsOf(raw.verifiedPaidUnitCosts);
            if (paid.length > 0) out.verifiedPaidUnitCosts = paid;
            const outstanding = moneyRowsOf(raw.verifiedOutstandingUnitCosts);
            if (outstanding.length > 0) out.verifiedOutstandingUnitCosts = outstanding;
            const pending = moneyRowsOf(raw.pendingVerificationUnitCosts);
            if (pending.length > 0) out.pendingVerificationUnitCosts = pending;
        }

        if (readable.unitCostCount) {
            out.unitCostDocumentCount = raw.unitCostDocumentCount;
        }

        // List price per m² only when the unit's price and area are readable; a price, so rounded at the currency.
        const avgLine = raw.averagePrice;
        const avgCurrency = avgLine ? currencyOfLine(avgLine) : undefined;
        if (readable.pricePerSquareMeter && avgLine && avgCurrency) {
            const totals: MoneyTotals = new Map();
            addMoney(totals, avgCurrency, avgLine.value == null ? 0 : String(avgLine.value));
            out.averagePricePerSquareMeter = moneyRowsOf(totals)[0];
        }
        return out;
    }

    /** Units with their price and currency, for the ROI report. */
    findForRoi(filter: FilterQuery<IUnit>) {
        return this.model.find(filter).noDeleted()
            .select("_id name unitNumber status price priceCurrency project")
            .populate("priceCurrency", "symbol abbreviation")
            .lean();
    }

    /** A unit with its floor, building and project populated. */
    findWithProjectChain(filter: FilterQuery<IUnit>, session: ClientSession | null | undefined) {
        return this.model.findOne(filter)
            .populate({
                path: "floor",
                populate: {
                    path: "edifice",
                    populate: {path: "project"},
                },
            })
            .session(session ?? null)
            .exec();
    }

    /** The matching units' names and numbers, as plain objects. */
    findLabelsLean(filter: FilterQuery<IUnit>) {
        return this.model.find(filter).select("name unitNumber").lean<{name?: string; unitNumber?: string}[]>();
    }

    /** A unit with what a price-change campaign shows (price, history, currency symbol, project name), as a plain object. */
    findPriceChangeLean(filter: FilterQuery<IUnit>) {
        return this.model.findOne(filter)
            .select("unitNumber name price priceHistory priceCurrency project")
            .populate("project", "name")
            .populate("priceCurrency", "symbol")
            .lean<{
                _id: ObjectId;
                unitNumber?: string;
                name?: string;
                price?: unknown;
                priceHistory?: {price?: unknown}[];
                priceCurrency?: {symbol?: string};
                project?: {_id?: ObjectId; name?: string} | ObjectId;
            }>();
    }

    /** Units with their number, name and sale, for a client audience. */
    findAudienceUnitsLean(filter: FilterQuery<IUnit>) {
        return this.model.find(filter).select("_id unitNumber name sale").lean<{_id: ObjectId; unitNumber?: string | number; name?: string; sale?: ObjectId | null}[]>();
    }
}

export const unitService = new UnitService();
