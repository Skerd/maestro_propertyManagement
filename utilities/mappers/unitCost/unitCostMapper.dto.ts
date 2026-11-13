import {IUnitCost} from "../../../database/schemas/unitCost/unitCost";
import {UnitCost} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {ConstructorSimple} from "armonia/src/modules/propertyManagement/dto/constructor.dto";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {ModificationRequestSimple} from "armonia/src/modules/propertyManagement/dto/modificationRequest.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitWithFloor} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ConstructorSimpleSnippet} from "@propertyManagement/database/schemas/constructor/constructor.snippets";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {FloorSimpleSnippet} from "@propertyManagement/database/schemas/floor/floor.snippets";
import {ModificationRequestSimpleSnippet} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    decimalToNumber,
    mapMedia,
    mapSnippet,
    nestedEntityToRef,
} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {DEFAULT_DECIMAL_PLACES, minorToNumber, multiplyMinor, sumMinor, toMinor} from "armonia/src/modules/core/helpers/money";

/** The populated currency's precision (GLB-08); 2 places while the currency is only an id or not readable. */
export function currencyDecimals(currency: unknown): number {
    const places = currency && typeof currency === "object" && "decimalPlaces" in currency ? currency.decimalPlaces : undefined;
    return typeof places === "number" ? places : DEFAULT_DECIMAL_PLACES;
}

type UnitCostAmounts = {expenditureItems?: {amount?: unknown; pricePerUnit?: unknown}[]; currency?: unknown};

/** The subtotal in minor units of the cost's currency, with that currency's decimal places. */
function unitCostSubtotalMinor(doc: UnitCostAmounts): {minor: bigint; decimals: number} {
    const decimals = currencyDecimals(doc.currency);
    const lines: bigint[] = [];
    for (const row of doc.expenditureItems || []) {
        const amt = typeof row.amount === "number" ? row.amount : parseFloat(String(row.amount));
        const ppu = decimalToNumber(row.pricePerUnit);
        if (Number.isFinite(amt) && ppu !== undefined && Number.isFinite(ppu)) lines.push(multiplyMinor(toMinor(ppu, decimals), amt));
    }
    return {minor: sumMinor(lines), decimals};
}

/**
 * Quantity × unit price per row, each rounded once at the currency's precision, summed exactly (D35). Reads only each
 * row's amount and price and the currency, so hydrated and lean unit costs both qualify; a row without a number in
 * either counts nothing.
 */
export function computeUnitCostSubtotal(doc: UnitCostAmounts): number {
    const {minor, decimals} = unitCostSubtotalMinor(doc);
    return minorToNumber(minor, decimals);
}

/** A unit's costs in one currency, exact at that currency's precision. */
export type UnitCostCurrencyTotal = {
    /** The currency's id, "" for a cost without one: amounts are only ever summed within one id. */
    currencyId: string;
    amount: number;
    /** The precision `amount` is exact at. */
    decimals: number;
    /** When the currency is populated with its symbol. */
    currencySymbol?: string;
};

/**
 * Each unit's costs per currency (TD-B213, TD-B223): summed in that currency's minor units (GLB-08), so a 3-decimal
 * currency is never cut to cents, and never added to another currency.
 */
export function unitCostTotalsByUnit(costs: (UnitCostAmounts & {unit?: unknown})[]): Map<string, UnitCostCurrencyTotal[]> {
    const byUnit = new Map<string, Map<string, {minor: bigint; decimals: number; symbol?: string}>>();
    for (const cost of costs) {
        const unitId = String(nestedEntityToRef(cost.unit) ?? "");
        const currencyId = String(nestedEntityToRef(cost.currency) ?? "");
        const {minor, decimals} = unitCostSubtotalMinor(cost);
        const symbol = cost.currency && typeof cost.currency === "object" && "symbol" in cost.currency && typeof cost.currency.symbol === "string"
            ? cost.currency.symbol
            : undefined;
        const perCurrency = byUnit.get(unitId) ?? new Map<string, {minor: bigint; decimals: number; symbol?: string}>();
        const sum = perCurrency.get(currencyId);
        perCurrency.set(currencyId, {minor: (sum?.minor ?? 0n) + minor, decimals, symbol});
        byUnit.set(unitId, perCurrency);
    }

    const totals = new Map<string, UnitCostCurrencyTotal[]>();
    for (const [unitId, perCurrency] of byUnit) {
        totals.set(unitId, [...perCurrency].map(([currencyId, sum]) => ({
            currencyId, amount: minorToNumber(sum.minor, sum.decimals), decimals: sum.decimals, currencySymbol: sum.symbol,
        })));
    }
    return totals;
}

function unitCostDocRowToDto(row: {
    title?: string;
    category?: string;
    amount?: number | string;
    unit?: string;
    pricePerUnit?: unknown;
    media?: unknown[];
}) {
    const mediaRaw = row.media;
    const media =
        Array.isArray(mediaRaw) && mediaRaw.length > 0 ? mediaRaw.filter((m) => m != null).map(mapMedia) : undefined;
    return {
        title: row.title || "",
        category: row.category || "",
        amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || 0,
        unit: row.unit || "",
        pricePerUnit: decimalToNumber(row.pricePerUnit),
        ...(media && media.length > 0 ? {media} : {}),
    };
}

export function unitCostToDTO(doc: IUnitCost): UnitCost {
    const expenditureItems = (doc.expenditureItems || []).map((row) => unitCostDocRowToDto(row));
    return {
        _id: doc._id.toString(),
        name: doc.name || "",
        unit: mapSnippet<UnitWithFloor>()(doc.unit, UnitSnippet),
        floor: mapSnippet<FloorSimple>()(doc.floor, FloorSimpleSnippet),
        edifice: mapSnippet<EdificeSimple>()(doc.edifice, EdificeSimpleSnippet),
        project: mapSnippet<ProjectSimple>()(doc.project, ProjectSimpleSnippet),
        purchasePerson: mapSnippet<SimpleBlankUser>()(doc.purchasePerson, SimpleBlankUserSnippet)!,
        purchaseDate: doc.purchaseDate || undefined,
        paymentDate: doc.paymentDate || undefined,
        notes: doc.notes,
        verificationStatus: doc.verificationStatus || "pending_verification",
        paymentStatus: doc.paymentStatus || "unpaid",
        tag: doc.tag,
        currency: mapSnippet<CurrencySimple>()(doc.currency, CurrencySimpleSnippet),
        invoiceNumber: doc.invoiceNumber,
        vendorName: doc.vendorName,
        relatedModificationRequest: mapSnippet<ModificationRequestSimple>()(doc.relatedModificationRequest, ModificationRequestSimpleSnippet),
        constructorRef: mapSnippet<ConstructorSimple>()(doc.constructorRef, ConstructorSimpleSnippet),
        invoiceMedia: Array.isArray(doc.invoiceMedia) ? doc.invoiceMedia.map(mapMedia) : [],
        expenditureItems,
        documentSubtotal: computeUnitCostSubtotal(doc),
        budgetedAmount: doc.budgetedAmount != null ? decimalToNumber(doc.budgetedAmount) : undefined,
        ...mapSoftDeleteToDTO(doc),
        ...mapOwnershipToDTO(doc),
        ...mapLifeCycleToDTO(doc)
    };
}

export function unitCostsToDTO(docs: IUnitCost[]): UnitCost[] {
    return docs.map(unitCostToDTO);
}
