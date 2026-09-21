import {describe, expect, it} from "vitest";
import mongoose, {Schema} from "mongoose";
import {Decimal128, ObjectId} from "mongodb";
import {
    applyPriceOnRequest,
    buildPriceOnRequestScope,
    isEdificePriceOnRequest,
    isPriceOnRequestRedacted,
    isUnitPriceOnRequest,
    priceVisibleUnitExpr,
    priceVisibleUnitMatch,
    redactUnitPrice,
} from "../priceOnRequest.util";
import type {MarketingProjectHierarchy} from "../marketingHierarchy.util";

const id = () => new ObjectId();

function hierarchyOf(edifices: any[], floors: any[], units: any[]): MarketingProjectHierarchy {
    return {
        edifices,
        floors,
        units,
        floorsByEdifice: new Map(),
        unitsByFloor: new Map(),
        edificesByProject: new Map(),
        unitsByProject: new Map(),
    } as unknown as MarketingProjectHierarchy;
}

function unit(floor: ObjectId | {_id: ObjectId}, extra: Record<string, unknown> = {}) {
    return {
        _id: id(),
        floor,
        price: Decimal128.fromString("150000"),
        priceHistory: [{price: Decimal128.fromString("140000")}],
        priceCurrency: {symbol: "€"},
        ...extra,
    };
}

describe("isUnitPriceOnRequest", () => {
    it("hides a unit flagged on itself", () => {
        const scope = buildPriceOnRequestScope([], []);
        expect(isUnitPriceOnRequest(unit(id(), {showPriceOnRequest: true}), scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit(id()), scope)).toBe(false);
    });

    it("hides every unit of a floor in scope, whether floor is an ObjectId or populated", () => {
        const floorId = id();
        const scope = buildPriceOnRequestScope([], [floorId]);
        expect(isUnitPriceOnRequest(unit(floorId), scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit({_id: floorId}), scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit(id()), scope)).toBe(false);
    });

    it("works for units without the denormalized edifice/project refs", () => {
        // A project flag reaches the unit only through the expanded floor set.
        const floorId = id();
        const scope = buildPriceOnRequestScope([id()], [floorId]);
        const legacyUnit = unit(floorId);
        expect("edifice" in legacyUnit).toBe(false);
        expect(isUnitPriceOnRequest(legacyUnit, scope)).toBe(true);
    });
});

describe("isEdificePriceOnRequest", () => {
    it("hides edifices flagged directly or reached through their project", () => {
        const inScope = id();
        const scope = buildPriceOnRequestScope([inScope], []);
        expect(isEdificePriceOnRequest({_id: inScope}, scope)).toBe(true);
        expect(isEdificePriceOnRequest({_id: id(), showPriceOnRequest: true}, scope)).toBe(true);
        expect(isEdificePriceOnRequest({_id: id()}, scope)).toBe(false);
    });
});

describe("applyPriceOnRequest", () => {
    it("redacts on-request units and edifices, leaving unflagged siblings intact", () => {
        const hiddenEdifice = {_id: id(), pricePerMeterSquared: 2500, verandaPricePerMeterSquared: 900, saleCurrency: {symbol: "€"}};
        const openEdifice = {_id: id(), pricePerMeterSquared: 2000, verandaPricePerMeterSquared: 800};
        const hiddenFloor = id();
        const openFloor = id();
        const hiddenUnit = unit(hiddenFloor);
        const openUnit = unit(openFloor);

        applyPriceOnRequest(
            hierarchyOf([hiddenEdifice, openEdifice], [], [hiddenUnit, openUnit]),
            buildPriceOnRequestScope([hiddenEdifice._id], [hiddenFloor]),
        );

        expect(hiddenUnit.price).toBeUndefined();
        expect(hiddenUnit.priceHistory).toBeUndefined();
        expect(hiddenUnit.priceCurrency).toBeUndefined();
        expect(isPriceOnRequestRedacted(hiddenUnit)).toBe(true);

        expect(hiddenEdifice.pricePerMeterSquared).toBeUndefined();
        expect(hiddenEdifice.verandaPricePerMeterSquared).toBeUndefined();
        expect(hiddenEdifice.saleCurrency).toBeUndefined();
        expect(isPriceOnRequestRedacted(hiddenEdifice)).toBe(true);

        expect(openUnit.price.toString()).toBe("150000");
        expect(isPriceOnRequestRedacted(openUnit)).toBe(false);
        expect(openEdifice.pricePerMeterSquared).toBe(2000);
        expect(isPriceOnRequestRedacted(openEdifice)).toBe(false);
    });
});

describe("areas are never redacted", () => {
    it("keeps every unit and edifice area on price-on-request records", () => {
        const floorId = id();
        const edifice = {_id: id(), totalArea: 5400, greenArea: 800, pricePerMeterSquared: 2500};
        const hiddenUnit = unit(floorId, {area: 95, netArea: 82, sharedArea: 9, verandaArea: 14});

        applyPriceOnRequest(
            hierarchyOf([edifice], [], [hiddenUnit]),
            buildPriceOnRequestScope([edifice._id], [floorId]),
        );

        expect(hiddenUnit.price).toBeUndefined();
        expect(hiddenUnit).toMatchObject({area: 95, netArea: 82, sharedArea: 9, verandaArea: 14});
        expect(edifice.pricePerMeterSquared).toBeUndefined();
        expect(edifice).toMatchObject({totalArea: 5400, greenArea: 800});
    });
});

describe("redactUnitPrice on Mongoose documents", () => {
    // Mirrors unit.price: a setter that throws on undefined. Redaction must not go through it.
    const TestUnit = mongoose.model(
        "PriceOnRequestTestUnit",
        new Schema({
            price: {
                type: Schema.Types.Decimal128,
                set: (v: unknown) => (v instanceof Decimal128 ? v : Decimal128.fromString((v as any).toString())),
            },
        }),
    );

    it("shadows the price without calling setters or marking the document modified", () => {
        // hydrate() = a document as loaded from the DB (nothing marked modified yet).
        const doc: any = TestUnit.hydrate({_id: id(), price: Decimal128.fromString("120000")});
        expect(doc.isModified("price")).toBe(false);
        expect(() => redactUnitPrice(doc)).not.toThrow();
        expect(doc.price).toBeUndefined();
        expect(doc.priceOnRequest).toBe(true);
        expect(doc.isModified("price")).toBe(false);
    });
});

describe("priceVisibleUnitMatch / priceVisibleUnitExpr", () => {
    it("excludes self-flagged units and floors in scope", () => {
        const floorId = id();
        const scope = buildPriceOnRequestScope([], [floorId]);
        expect(priceVisibleUnitMatch(scope)).toEqual({
            $and: [{showPriceOnRequest: {$ne: true}}, {floor: {$nin: [floorId]}}],
        });
        expect(priceVisibleUnitExpr(scope)).toEqual({
            $and: [{$ne: ["$showPriceOnRequest", true]}, {$not: [{$in: ["$floor", [floorId]]}]}],
        });
    });

    it("only checks the unit flag when no floor is in scope", () => {
        const scope = buildPriceOnRequestScope([], []);
        expect(priceVisibleUnitMatch(scope)).toEqual({$and: [{showPriceOnRequest: {$ne: true}}]});
    });
});
