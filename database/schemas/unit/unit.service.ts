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
import {InstallmentStatus, PaymentPlanStatus} from '../paymentPlan/paymentPlan';
import Unit, {IUnit} from './unit';
import UnitCost from '../unitCost/unitCost';
import {unitCostService} from '../unitCost/unitCost.service';
import {objectIdFromRef, resolveHierarchySetsFromUnitIds} from '../unitCost/unitCostHierarchy.util';
import {
    inheritedUnitCostCountByUnitPipeline,
    inheritedUnitCostMoneyByUnitPipeline,
} from '../unitCost/unitCostInheritedPipelines.util';
import {
    UnitMoneyByCurrency,
    UnitStatistics
} from 'armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.dto';
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";

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

// Internal accumulator for merging aggregate currency rows before DTO conversion.
interface UnitStatsCurrencyAccum {
    currencyId: string;
    currencyName: string;
    currencySymbol: string;
    currencyAbbreviation: string;
    sum: number;
}

export class UnitService extends BaseCrudService<IUnit, typeof Unit> {
    constructor() {
        super(Unit, 'Unit');
    }

    /** Parses numeric amounts from aggregation line items (Decimal128-safe). */
    private static parseAggregateMoneyValue(v: unknown): number {
        if (v == null) return 0;
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        if (typeof v === 'object' && v !== null && typeof (v as {toString?: () => string}).toString === 'function') {
            return parseFloat((v as {toString: () => string}).toString()) || 0;
        }
        return parseFloat(String(v)) || 0;
    }

    /** Sums aggregate `collectedByCurrency` / `unpaidByCurrency` rows into a per-unit currency map. */
    private static foldPerUnitCurrencyLines(
        aggregateRows: any[],
        itemsKey: 'collectedByCurrency' | 'unpaidByCurrency',
        getUnitTarget: (unitKey: string) => Map<string, UnitStatsCurrencyAccum>
    ): void {
        for (const row of aggregateRows) {
            const uid = row._id?.toString();
            if (!uid) continue;
            const target = getUnitTarget(uid);
            for (const inv of row[itemsKey] || []) {
                const value = UnitService.parseAggregateMoneyValue(inv?.value);
                const cid = inv?.currencyId;
                if (cid == null) continue;
                const k = cid.toString();
                const existing = target.get(k);
                if (existing) existing.sum += value;
                else
                    target.set(k, {
                        currencyId: k,
                        currencyName: inv.currencyName || '',
                        currencySymbol: inv.currencySymbol || '',
                        currencyAbbreviation: inv.currencyAbbreviation || '',
                        sum: value,
                    });
            }
        }
    }

    /** Converts internal currency accumulators to API money rows. */
    private static accumMapToEdificeMoneyDto(map: Map<string, UnitStatsCurrencyAccum>): EdificeMoneyByCurrency[] {
        return [...map.values()].map((v) => ({
            currency: {
                _id: v.currencyId,
                name: v.currencyName,
                symbol: v.currencySymbol,
                abbreviation: v.currencyAbbreviation,
            },
            value: Number.isNaN(v.sum) ? 0 : v.sum,
        }));
    }

    /** Merges money rows by currency id (same merge semantics as floor/edifice rollup helpers). */
    private static mergeMoneyRowsToUnitDto(rows: EdificeMoneyByCurrency[]): UnitMoneyByCurrency[] {
        if (rows.length === 0) return [];
        const mergeMap = new Map<string, UnitStatsCurrencyAccum>();
        for (const row of rows) {
            const id = row.currency?._id;
            if (id == null) continue;
            const v = row.value ?? 0;
            const k = id.toString();
            const existing = mergeMap.get(k);
            if (existing) existing.sum += v;
            else
                mergeMap.set(k, {
                    currencyId: k,
                    currencyName: row.currency?.name ?? '',
                    currencySymbol: row.currency?.symbol ?? '',
                    currencyAbbreviation: row.currency?.abbreviation ?? '',
                    sum: v,
                });
        }
        return [...mergeMap.values()].map((acc) => ({
            currency: {
                _id: acc.currencyId,
                name: acc.currencyName,
                symbol: acc.currencySymbol,
                abbreviation: acc.currencyAbbreviation,
            },
            value: Number.isNaN(acc.sum) ? 0 : acc.sum,
        }));
    }

    /** True when SchemaGuard left enough payment-plan keys to read unpaid/collected plan money. */
    private static salePaymentPlanMoneyReadable(salePpFields: Record<string, unknown> | null | undefined): boolean {
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
    async calculateStatistics(unitIds: ObjectId[], actionUserCtx: UserContext, languageCode: string, options: {logger?: any} = {}): Promise<Record<string, UnitStatistics>> {
        const {logger} = options;

        // No units requested — nothing to aggregate or return.
        if (unitIds.length === 0) {
            return {};
        }

        const hierarchySets = await resolveHierarchySetsFromUnitIds(unitIds, {logger, languageCode});
        const unitForCompany = await this.findOne({_id: unitIds[0]}, {logger, languageCode}, undefined, 'company');
        const companyIdForInherited = objectIdFromRef(
            (unitForCompany as {_id?: unknown; company?: unknown} | null)?.company,
        );

        const emptyInheritedAgg: Record<string, unknown>[] = [{$match: {_id: {$in: []}}}];
        const inheritedPaidPl =
            companyIdForInherited != null
                ? inheritedUnitCostMoneyByUnitPipeline(companyIdForInherited, unitIds, hierarchySets, {
                      verificationStatus: 'verified',
                      paymentStatus: 'paid',
                  })
                : emptyInheritedAgg;
        const inheritedOutstandingPl =
            companyIdForInherited != null
                ? inheritedUnitCostMoneyByUnitPipeline(companyIdForInherited, unitIds, hierarchySets, {
                      verificationStatus: 'verified',
                      paymentStatus: {$in: ['unpaid', 'partially_paid', 'disputed']},
                  })
                : emptyInheritedAgg;
        const inheritedPendingPl =
            companyIdForInherited != null
                ? inheritedUnitCostMoneyByUnitPipeline(companyIdForInherited, unitIds, hierarchySets, {
                      verificationStatus: {$in: ['pending_verification', 'needs_revision']},
                  })
                : emptyInheritedAgg;
        const inheritedCountPl =
            companyIdForInherited != null
                ? inheritedUnitCostCountByUnitPipeline(companyIdForInherited, unitIds, hierarchySets)
                : emptyInheritedAgg;

        // List price per m² (unit area only): one row per unit with priceCurrency metadata.
        const unitAveragePricePerSqmPipeline = [
            {$match: {_id: {$in: unitIds}}},
            {
                $addFields: {
                    areaForSqm: {$toDouble: {$ifNull: ['$area', 0]}},
                    priceDouble: {$toDouble: {$ifNull: ['$price', 0]}},
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'priceCurrency',
                    foreignField: '_id',
                    as: 'pc',
                },
            },
            {$unwind: {path: '$pc', preserveNullAndEmptyArrays: true}},
            {
                $project: {
                    _id: 1,
                    pricePerSqm: {
                        $cond: {
                            if: {$gt: ['$areaForSqm', 0]},
                            then: {$divide: ['$priceDouble', '$areaForSqm']},
                            else: 0,
                        },
                    },
                    currencyId: '$priceCurrency',
                    currencyName: {$ifNull: ['$pc.name', '']},
                    currencySymbol: {$ifNull: ['$pc.symbol', '']},
                    currencyAbbreviation: {$ifNull: ['$pc.abbreviation', '']},
                },
            },
        ];

        // Collected cash: final sale price per unit and sale currency.
        const salesCollectedCashByUnitPipeline = [
            {$match: {unit: {$in: unitIds}, paymentType: SalePaymentType.CASH}},
            {$addFields: {collectedAmountRaw: {$toDouble: '$finalPrice'}}},
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'saleCurrency',
                    foreignField: '_id',
                    as: 'saleCurrInfo',
                },
            },
            {$unwind: {path: '$saleCurrInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$saleCurrency'},
                    collected: {$sum: '$collectedAmountRaw'},
                    currencyInfo: {$first: '$saleCurrInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    collectedByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$collected',
                        },
                    },
                },
            },
        ];

        // Collected on payment-plan sales: down payment paid plus installment paid amounts.
        const salesCollectedPaymentPlanByUnitPipeline = [
            {$match: {unit: {$in: unitIds}, paymentType: SalePaymentType.PAYMENT_PLAN}},
            {
                $lookup: {
                    from: 'paymentplans',
                    localField: 'paymentPlan',
                    foreignField: '_id',
                    as: 'ppDoc',
                },
            },
            {
                $addFields: {
                    pp0: {$arrayElemAt: ['$ppDoc', 0]},
                    installmentPaidTotal: {
                        $reduce: {
                            input: {$ifNull: ['$pp0.installments', []]},
                            initialValue: 0,
                            in: {$add: ['$$value', {$toDouble: {$ifNull: ['$$this.paidAmount', 0]}}]},
                        },
                    },
                },
            },
            {
                $addFields: {
                    collectedAmountRaw: {
                        $add: [{$toDouble: {$ifNull: ['$pp0.downPaymentPaid', 0]}}, '$installmentPaidTotal'],
                    },
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'saleCurrency',
                    foreignField: '_id',
                    as: 'saleCurrInfo',
                },
            },
            {$unwind: {path: '$saleCurrInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$saleCurrency'},
                    collected: {$sum: '$collectedAmountRaw'},
                    currencyInfo: {$first: '$saleCurrInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    collectedByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$collected',
                        },
                    },
                },
            },
        ];

        // Paid reservation deposits (active reservations) counted as collected per unit/currency.
        const reservationDepositPaidByUnitPipeline = [
            {
                $match: {
                    isActive: true,
                    paid: true,
                    depositAmount: {$exists: true, $ne: null},
                    depositCurrency: {$exists: true, $ne: null},
                    unit: {$in: unitIds},
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'depositCurrency',
                    foreignField: '_id',
                    as: 'currencyInfo',
                },
            },
            {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$depositCurrency'},
                    collected: {$sum: {$toDouble: '$depositAmount'}},
                    currencyInfo: {$first: '$currencyInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    collectedByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$collected',
                        },
                    },
                },
            },
        ];

        // Unpaid reservation deposits (active) counted as not collected per unit/currency.
        const reservationDepositUnpaidByUnitPipeline = [
            {
                $match: {
                    isActive: true,
                    paid: false,
                    depositAmount: {$exists: true, $ne: null},
                    depositCurrency: {$exists: true, $ne: null},
                    unit: {$in: unitIds},
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'depositCurrency',
                    foreignField: '_id',
                    as: 'currencyInfo',
                },
            },
            {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$depositCurrency'},
                    outstanding: {$sum: {$toDouble: '$depositAmount'}},
                    currencyInfo: {$first: '$currencyInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    unpaidByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$outstanding',
                        },
                    },
                },
            },
        ];

        // Remaining balance on non-cancelled payment plans: unpaid down + unpaid installments.
        const salePaymentPlanUnpaidByUnitPipeline = [
            {
                $match: {
                    unit: {$in: unitIds},
                    paymentPlan: {$exists: true, $ne: null},
                    paymentType: SalePaymentType.PAYMENT_PLAN,
                },
            },
            {
                $lookup: {
                    from: 'paymentplans',
                    localField: 'paymentPlan',
                    foreignField: '_id',
                    as: 'ppArr',
                },
            },
            {$unwind: '$ppArr'},
            {$match: {'ppArr.status': {$ne: PaymentPlanStatus.CANCELLED}}},
            {
                $addFields: {
                    unpaidDown: {
                        $max: [
                            0,
                            {
                                $subtract: [
                                    {$toDouble: '$ppArr.downPayment'},
                                    {$toDouble: {$ifNull: ['$ppArr.downPaymentPaid', 0]}},
                                ],
                            },
                        ],
                    },
                    unpaidInstallments: {
                        $reduce: {
                            input: {
                                $filter: {
                                    input: {$ifNull: ['$ppArr.installments', []]},
                                    as: 'i',
                                    cond: {$ne: ['$$i.status', InstallmentStatus.CANCELLED]},
                                },
                            },
                            initialValue: 0,
                            in: {
                                $add: [
                                    '$$value',
                                    {
                                        $max: [
                                            0,
                                            {
                                                $subtract: [
                                                    {$toDouble: {$ifNull: ['$$this.amount', 0]}},
                                                    {$toDouble: {$ifNull: ['$$this.paidAmount', 0]}},
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {
                $addFields: {
                    totalUnpaid: {$add: ['$unpaidDown', '$unpaidInstallments']},
                },
            },
            {$match: {totalUnpaid: {$gt: 0}}},
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'saleCurrency',
                    foreignField: '_id',
                    as: 'saleCurrInfo',
                },
            },
            {$unwind: {path: '$saleCurrInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$saleCurrency'},
                    unpaid: {$sum: '$totalUnpaid'},
                    currencyInfo: {$first: '$saleCurrInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    unpaidByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$unpaid',
                        },
                    },
                },
            },
        ];

        const unitCostVerifiedPaidByUnitPipeline = [
            {
                $match: {
                    unit: {$in: unitIds},
                    verificationStatus: 'verified',
                    paymentStatus: 'paid',
                    $or: [{deletedAt: {$exists: false}}, {deletedAt: null}],
                },
            },
            {
                $addFields: {
                    docSubtotal: {
                        $sum: {
                            $map: {
                                input: {$ifNull: ['$expenditureItems', []]},
                                as: 'row',
                                in: {
                                    $multiply: [
                                        {$toDouble: {$ifNull: ['$$row.amount', 0]}},
                                        {$convert: {input: '$$row.pricePerUnit', to: 'double', onError: 0, onNull: 0}},
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'currency',
                    foreignField: '_id',
                    as: 'currencyInfo',
                },
            },
            {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$currency'},
                    total: {$sum: '$docSubtotal'},
                    currencyInfo: {$first: '$currencyInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    collectedByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$total',
                        },
                    },
                },
            },
        ];

        const unitCostVerifiedOutstandingByUnitPipeline = [
            {
                $match: {
                    unit: {$in: unitIds},
                    verificationStatus: 'verified',
                    paymentStatus: {$in: ['unpaid', 'partially_paid', 'disputed']},
                    $or: [{deletedAt: {$exists: false}}, {deletedAt: null}],
                },
            },
            {
                $addFields: {
                    docSubtotal: {
                        $sum: {
                            $map: {
                                input: {$ifNull: ['$expenditureItems', []]},
                                as: 'row',
                                in: {
                                    $multiply: [
                                        {$toDouble: {$ifNull: ['$$row.amount', 0]}},
                                        {$convert: {input: '$$row.pricePerUnit', to: 'double', onError: 0, onNull: 0}},
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'currency',
                    foreignField: '_id',
                    as: 'currencyInfo',
                },
            },
            {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$currency'},
                    total: {$sum: '$docSubtotal'},
                    currencyInfo: {$first: '$currencyInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    collectedByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$total',
                        },
                    },
                },
            },
        ];

        const unitCostPendingVerificationByUnitPipeline = [
            {
                $match: {
                    unit: {$in: unitIds},
                    verificationStatus: {$in: ['pending_verification', 'needs_revision']},
                    $or: [{deletedAt: {$exists: false}}, {deletedAt: null}],
                },
            },
            {
                $addFields: {
                    docSubtotal: {
                        $sum: {
                            $map: {
                                input: {$ifNull: ['$expenditureItems', []]},
                                as: 'row',
                                in: {
                                    $multiply: [
                                        {$toDouble: {$ifNull: ['$$row.amount', 0]}},
                                        {$convert: {input: '$$row.pricePerUnit', to: 'double', onError: 0, onNull: 0}},
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: 'currencies',
                    localField: 'currency',
                    foreignField: '_id',
                    as: 'currencyInfo',
                },
            },
            {$unwind: {path: '$currencyInfo', preserveNullAndEmptyArrays: true}},
            {
                $group: {
                    _id: {unit: '$unit', currency: '$currency'},
                    total: {$sum: '$docSubtotal'},
                    currencyInfo: {$first: '$currencyInfo'},
                },
            },
            {
                $group: {
                    _id: '$_id.unit',
                    collectedByCurrency: {
                        $push: {
                            currencyId: '$_id.currency',
                            currencyName: {$ifNull: ['$currencyInfo.name', '']},
                            currencySymbol: {$ifNull: ['$currencyInfo.symbol', '']},
                            currencyAbbreviation: {$ifNull: ['$currencyInfo.abbreviation', '']},
                            value: '$total',
                        },
                    },
                },
            },
        ];

        const unitCostCountByUnitPipeline = [
            {
                $match: {
                    unit: {$in: unitIds},
                    $or: [{deletedAt: {$exists: false}}, {deletedAt: null}],
                },
            },
            {
                $group: {
                    _id: '$unit',
                    count: {$sum: 1},
                },
            },
        ];

        // Run unit listing-price pipeline plus sale and reservation money aggregations in parallel.
        const [
            unitAvgPriceRows,
            salesCollectedCashByUnit,
            salesCollectedPaymentPlanByUnit,
            reservationPaidByUnit,
            reservationUnpaidByUnit,
            salePaymentPlanUnpaidByUnit,
            unitCostVerifiedPaidByUnit,
            unitCostVerifiedOutstandingByUnit,
            unitCostCountByUnit,
            unitCostPendingVerificationByUnit,
            unitCostInheritedVerifiedPaidByUnit,
            unitCostInheritedVerifiedOutstandingByUnit,
            unitCostInheritedPendingByUnit,
            unitCostInheritedCountByUnit,
        ] = await Promise.all([
            this.aggregate(unitAveragePricePerSqmPipeline, {logger, languageCode}),
            saleService.aggregate(salesCollectedCashByUnitPipeline, {logger, languageCode}),
            saleService.aggregate(salesCollectedPaymentPlanByUnitPipeline, {logger, languageCode}),
            reservationService.aggregate(reservationDepositPaidByUnitPipeline, {logger, languageCode}),
            reservationService.aggregate(reservationDepositUnpaidByUnitPipeline, {logger, languageCode}),
            saleService.aggregate(salePaymentPlanUnpaidByUnitPipeline, {logger, languageCode}),
            unitCostService.aggregate(unitCostVerifiedPaidByUnitPipeline, {logger, languageCode}),
            unitCostService.aggregate(unitCostVerifiedOutstandingByUnitPipeline, {logger, languageCode}),
            unitCostService.aggregate(unitCostCountByUnitPipeline, {logger, languageCode}),
            unitCostService.aggregate(unitCostPendingVerificationByUnitPipeline, {logger, languageCode}),
            unitCostService.aggregate(inheritedPaidPl, {logger, languageCode}),
            unitCostService.aggregate(inheritedOutstandingPl, {logger, languageCode}),
            unitCostService.aggregate(inheritedPendingPl, {logger, languageCode}),
            unitCostService.aggregate(inheritedCountPl, {logger, languageCode}),
        ]);

        const unitCostDocumentCounts = new Map<string, number>();
        for (const row of unitCostCountByUnit as { _id?: unknown; count?: number }[]) {
            const uid = row._id?.toString();
            if (uid != null && uid !== '') unitCostDocumentCounts.set(uid, row.count ?? 0);
        }
        for (const row of unitCostInheritedCountByUnit as { _id?: unknown; count?: number }[]) {
            const uid = row._id?.toString();
            if (uid != null && uid !== '') {
                unitCostDocumentCounts.set(uid, (unitCostDocumentCounts.get(uid) ?? 0) + (row.count ?? 0));
            }
        }

        // Map unit id -> raw average price row (for permission-filtered output).
        const averagePriceByUnitId = new Map<string, {pricePerSqm: number; currencyId: unknown; currencyName: string; currencySymbol: string; currencyAbbreviation: string}>();
        for (const row of unitAvgPriceRows) {
            const uid = row._id?.toString();
            if (!uid) continue;
            averagePriceByUnitId.set(uid, {
                pricePerSqm: typeof row.pricePerSqm === 'number' && !Number.isNaN(row.pricePerSqm) ? row.pricePerSqm : 0,
                currencyId: row.currencyId,
                currencyName: row.currencyName ?? '',
                currencySymbol: row.currencySymbol ?? '',
                currencyAbbreviation: row.currencyAbbreviation ?? '',
            });
        }

        // Raw stats per unit id (money DTOs only, for permission filtering below).
        const statisticsMap = new Map<string, any>();
        // Per-unit maps: each money bucket keyed by currency id string.
        const collectedCashByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const collectedPaymentPlanByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const collectedReservationDepositsByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const notCollectedReservationByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const notCollectedPaymentPlanByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const verifiedPaidUnitCostsByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const verifiedOutstandingUnitCostsByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();
        const pendingVerificationUnitCostsByUnit = new Map<string, Map<string, UnitStatsCurrencyAccum>>();

        // Initialize empty per-unit currency maps for every requested unit id.
        for (const id of unitIds) {
            const key = id.toString();
            collectedCashByUnit.set(key, new Map());
            collectedPaymentPlanByUnit.set(key, new Map());
            collectedReservationDepositsByUnit.set(key, new Map());
            notCollectedReservationByUnit.set(key, new Map());
            notCollectedPaymentPlanByUnit.set(key, new Map());
            verifiedPaidUnitCostsByUnit.set(key, new Map());
            verifiedOutstandingUnitCostsByUnit.set(key, new Map());
            pendingVerificationUnitCostsByUnit.set(key, new Map());
        }

        UnitService.foldPerUnitCurrencyLines(salesCollectedCashByUnit, 'collectedByCurrency', (uid) => collectedCashByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(salesCollectedPaymentPlanByUnit, 'collectedByCurrency', (uid) => collectedPaymentPlanByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(reservationPaidByUnit, 'collectedByCurrency', (uid) => collectedReservationDepositsByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(reservationUnpaidByUnit, 'unpaidByCurrency', (uid) => notCollectedReservationByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(salePaymentPlanUnpaidByUnit, 'unpaidByCurrency', (uid) => notCollectedPaymentPlanByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(unitCostVerifiedPaidByUnit, 'collectedByCurrency', (uid) => verifiedPaidUnitCostsByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(unitCostVerifiedOutstandingByUnit, 'collectedByCurrency', (uid) => verifiedOutstandingUnitCostsByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(unitCostPendingVerificationByUnit, 'collectedByCurrency', (uid) => pendingVerificationUnitCostsByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(unitCostInheritedVerifiedPaidByUnit, 'collectedByCurrency', (uid) => verifiedPaidUnitCostsByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(unitCostInheritedVerifiedOutstandingByUnit, 'collectedByCurrency', (uid) => verifiedOutstandingUnitCostsByUnit.get(uid)!);
        UnitService.foldPerUnitCurrencyLines(unitCostInheritedPendingByUnit, 'collectedByCurrency', (uid) => pendingVerificationUnitCostsByUnit.get(uid)!);

        // Convert money accumulators to DTO arrays per unit for permission checks.
        for (const unitId of unitIds) {
            const key = unitId.toString();
            const cashMap = collectedCashByUnit.get(key) || new Map();
            const ppCollMap = collectedPaymentPlanByUnit.get(key) || new Map();
            const resPaidMap = collectedReservationDepositsByUnit.get(key) || new Map();
            const ncResMap = notCollectedReservationByUnit.get(key) || new Map();
            const ncPpMap = notCollectedPaymentPlanByUnit.get(key) || new Map();
            const ucPaidMap = verifiedPaidUnitCostsByUnit.get(key) || new Map();
            const ucOutMap = verifiedOutstandingUnitCostsByUnit.get(key) || new Map();
            const pendMap = pendingVerificationUnitCostsByUnit.get(key) || new Map();

            statisticsMap.set(key, {
                _collectedCash: UnitService.accumMapToEdificeMoneyDto(cashMap),
                _collectedPaymentPlan: UnitService.accumMapToEdificeMoneyDto(ppCollMap),
                _collectedReservationDeposits: UnitService.accumMapToEdificeMoneyDto(resPaidMap),
                _notCollectedReservationDeposits: UnitService.accumMapToEdificeMoneyDto(ncResMap),
                _notCollectedPaymentPlanUnpaid: UnitService.accumMapToEdificeMoneyDto(ncPpMap),
                _verifiedPaidUnitCosts: UnitService.accumMapToEdificeMoneyDto(ucPaidMap),
                _verifiedOutstandingUnitCosts: UnitService.accumMapToEdificeMoneyDto(ucOutMap),
                _pendingVerificationUnitCosts: UnitService.accumMapToEdificeMoneyDto(pendMap),
                _unitCostDocumentCount: unitCostDocumentCounts.get(key) ?? 0,
            });
        }

        // Build API result: permission-filter money fields only.
        const result: Record<string, UnitStatistics> = {};
        for (const unitId of unitIds) {
            const key = unitId.toString();
            const raw = statisticsMap.get(key) || {};

            const out: UnitStatistics = {};
            const collectedParts: EdificeMoneyByCurrency[] = [];
            const notCollectedParts: EdificeMoneyByCurrency[] = [];

            // Permission: include cash sale collected totals when finalPrice and saleCurrency are readable.
            try {
                const saleCashFields = SchemaGuard.sanitizeFields(Sale, SALE_CASH_COLLECTED_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (saleCashFields?.finalPrice && saleCashFields?.saleCurrency && raw._collectedCash) {
                    collectedParts.push(...(raw._collectedCash as EdificeMoneyByCurrency[]));
                }
            } catch {
                /* no sale cash money read */
            }

            // Permission: include payment-plan collected when sale currency, type, and plan money fields are readable.
            try {
                const salePpFields = SchemaGuard.sanitizeFields(Sale, SALE_PAYMENT_PLAN_MONEY_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (UnitService.salePaymentPlanMoneyReadable(salePpFields as Record<string, unknown>) && raw._collectedPaymentPlan) {
                    collectedParts.push(...(raw._collectedPaymentPlan as EdificeMoneyByCurrency[]));
                }
            } catch {
                /* no sale payment-plan money read */
            }

            // Permission: include paid reservation deposits in collected when deposit fields are readable.
            try {
                const resCollectedFields = SchemaGuard.sanitizeFields(Reservation, RESERVATION_DEPOSIT_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (resCollectedFields?.depositAmount && resCollectedFields?.depositCurrency && raw._collectedReservationDeposits) {
                    collectedParts.push(...(raw._collectedReservationDeposits as EdificeMoneyByCurrency[]));
                }
            } catch {
                /* no reservation deposit read */
            }

            const mergedCollected = UnitService.mergeMoneyRowsToUnitDto(collectedParts);

            // Permission: unpaid reservation deposits in not collected.
            try {
                const resFields = SchemaGuard.sanitizeFields(Reservation, RESERVATION_DEPOSIT_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (resFields?.depositAmount && resFields?.depositCurrency && raw._notCollectedReservationDeposits) {
                    notCollectedParts.push(...(raw._notCollectedReservationDeposits as EdificeMoneyByCurrency[]));
                }
            } catch {
                /* no reservation deposit read */
            }

            // Permission: unpaid payment-plan balance in not collected.
            try {
                const salePpFieldsNc = SchemaGuard.sanitizeFields(Sale, SALE_PAYMENT_PLAN_MONEY_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (UnitService.salePaymentPlanMoneyReadable(salePpFieldsNc as Record<string, unknown>) && raw._notCollectedPaymentPlanUnpaid) {
                    notCollectedParts.push(...(raw._notCollectedPaymentPlanUnpaid as EdificeMoneyByCurrency[]));
                }
            } catch {
                /* no sale payment-plan money read */
            }

            const mergedNotCollected = UnitService.mergeMoneyRowsToUnitDto(notCollectedParts);

            if (mergedCollected.length > 0) {
                out.collectedAmount = mergedCollected;
            }
            out.notCollectedAmount = mergedNotCollected;

            try {
                const ucStatsFields = SchemaGuard.sanitizeFields(UnitCost, UNIT_COST_STATS_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (
                    ucStatsFields?.verificationStatus &&
                    ucStatsFields?.paymentStatus &&
                    ucStatsFields?.currency &&
                    ucStatsFields?.expenditureItems &&
                    raw._verifiedPaidUnitCosts?.length
                ) {
                    const merged = UnitService.mergeMoneyRowsToUnitDto(raw._verifiedPaidUnitCosts as EdificeMoneyByCurrency[]);
                    if (merged.length > 0) {
                        out.verifiedPaidUnitCosts = merged;
                    }
                }
            } catch {
                /* no unit cost stats read */
            }

            try {
                const ucStatsFieldsOut = SchemaGuard.sanitizeFields(UnitCost, UNIT_COST_STATS_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (
                    ucStatsFieldsOut?.verificationStatus &&
                    ucStatsFieldsOut?.paymentStatus &&
                    ucStatsFieldsOut?.currency &&
                    ucStatsFieldsOut?.expenditureItems &&
                    raw._verifiedOutstandingUnitCosts?.length
                ) {
                    const merged = UnitService.mergeMoneyRowsToUnitDto(raw._verifiedOutstandingUnitCosts as EdificeMoneyByCurrency[]);
                    if (merged.length > 0) {
                        out.verifiedOutstandingUnitCosts = merged;
                    }
                }
            } catch {
                /* no unit cost stats read */
            }

            try {
                const ucPendFields = SchemaGuard.sanitizeFields(UnitCost, UNIT_COST_STATS_READ_SHAPE as any, 'read', actionUserCtx, languageCode);
                if (
                    ucPendFields?.verificationStatus &&
                    ucPendFields?.paymentStatus &&
                    ucPendFields?.currency &&
                    ucPendFields?.expenditureItems &&
                    raw._pendingVerificationUnitCosts?.length
                ) {
                    const mergedPend = UnitService.mergeMoneyRowsToUnitDto(raw._pendingVerificationUnitCosts as EdificeMoneyByCurrency[]);
                    if (mergedPend.length > 0) {
                        out.pendingVerificationUnitCosts = mergedPend;
                    }
                }
            } catch {
                /* no unit cost pending verification read */
            }

            try {
                const ucCountFields = SchemaGuard.sanitizeFields(UnitCost, {unit: {}}, 'read', actionUserCtx, languageCode);
                if (ucCountFields?.unit && raw._unitCostDocumentCount != null) {
                    out.unitCostDocumentCount = raw._unitCostDocumentCount as number;
                }
            } catch {
                /* no unit cost document count read */
            }

            // Permission: expose list price per m² only when unit price and area are readable.
            try {
                const unitFieldsAvg = SchemaGuard.sanitizeFields(Unit, {price: {}, area: {}}, 'read', actionUserCtx, languageCode);
                if (unitFieldsAvg?.price && unitFieldsAvg?.area) {
                    const avgRow = averagePriceByUnitId.get(key);
                    const cid = avgRow?.currencyId;
                    if (avgRow != null && cid != null) {
                        out.averagePricePerSquareMeter = {
                            currency: {
                                _id: String(cid),
                                name: avgRow.currencyName,
                                symbol: avgRow.currencySymbol,
                                abbreviation: avgRow.currencyAbbreviation,
                            },
                            value: avgRow.pricePerSqm,
                        };
                    }
                }
            } catch {
                /* no unit price/area read */
            }

            result[key] = out;
        }
        return result;
    }
}

export const unitService = new UnitService();
