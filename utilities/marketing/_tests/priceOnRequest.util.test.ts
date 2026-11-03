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
    resolvePriceVisibility,
} from "../priceOnRequest.util";
import type {MarketingProjectHierarchy} from "../marketingHierarchy.util";

const id = () => new ObjectId();
const emptyScope = () => buildPriceOnRequestScope({projects: [], edifices: [], floors: []});

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

/** project → edifice → floor chain with the given visibility per level (undefined = inherit). */
function chain(visibility: {project?: string; edifice?: string; floor?: string} = {}) {
    const project = {_id: id(), priceVisibility: visibility.project};
    const edifice = {_id: id(), project: project._id, priceVisibility: visibility.edifice};
    const floor = {_id: id(), edifice: edifice._id, priceVisibility: visibility.floor};
    const scope = buildPriceOnRequestScope({projects: [project], edifices: [edifice], floors: [floor]});
    return {project, edifice, floor, scope};
}

describe("resolvePriceVisibility (nearest explicit choice wins)", () => {
    it.each([
        [{}, false, "default"],
        [{project: "inherit", edifice: "inherit", floor: "inherit", unit: "inherit"}, false, "default"],
        [{project: "hide"}, true, "project"],
        [{edifice: "hide", unit: "show"}, false, "unit"],
        [{edifice: "hide"}, true, "edifice"],
        [{project: "hide", edifice: "show"}, false, "edifice"],
        [{project: "hide", edifice: "show", floor: "hide"}, true, "floor"],
        [{project: "hide", edifice: "show", floor: "hide", unit: "show"}, false, "unit"],
    ])("%o → hidden=%s from %s", (levels, hidden, source) => {
        expect(resolvePriceVisibility(levels)).toEqual({
            hidden,
            source,
            key: `${hidden ? "hidden" : "shown"}_${source}`,
        });
    });

    it("ignores unknown / legacy values", () => {
        expect(resolvePriceVisibility({project: true as unknown, unit: "maybe"}).source).toBe("default");
    });
});

describe("isUnitPriceOnRequest", () => {
    it("follows the unit's own explicit choice", () => {
        expect(isUnitPriceOnRequest(unit(id(), {priceVisibility: "hide"}), emptyScope())).toBe(true);
        expect(isUnitPriceOnRequest(unit(id(), {priceVisibility: "show"}), emptyScope())).toBe(false);
        expect(isUnitPriceOnRequest(unit(id()), emptyScope())).toBe(false);
    });

    it("inherits from a hidden edifice, but a unit set to show overrides it", () => {
        const {floor, scope} = chain({edifice: "hide"});
        expect(isUnitPriceOnRequest(unit(floor._id), scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit({_id: floor._id}), scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit(floor._id, {priceVisibility: "inherit"}), scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit(floor._id, {priceVisibility: "show"}), scope)).toBe(false);
    });

    it("lets a shown edifice override a hidden project, and a hidden floor override it again", () => {
        const shownEdifice = chain({project: "hide", edifice: "show"});
        expect(isUnitPriceOnRequest(unit(shownEdifice.floor._id), shownEdifice.scope)).toBe(false);

        const hiddenFloor = chain({project: "hide", edifice: "show", floor: "hide"});
        expect(isUnitPriceOnRequest(unit(hiddenFloor.floor._id), hiddenFloor.scope)).toBe(true);
        expect(isUnitPriceOnRequest(unit(hiddenFloor.floor._id, {priceVisibility: "show"}), hiddenFloor.scope)).toBe(false);
    });

    it("works for units without the denormalized edifice/project refs", () => {
        const {floor, scope} = chain({project: "hide"});
        const legacyUnit = unit(floor._id);
        expect("edifice" in legacyUnit).toBe(false);
        expect(isUnitPriceOnRequest(legacyUnit, scope)).toBe(true);
    });

    it("leaves units on undecided floors shown", () => {
        const {scope} = chain({edifice: "hide"});
        expect(isUnitPriceOnRequest(unit(id()), scope)).toBe(false);
    });
});

describe("isEdificePriceOnRequest", () => {
    it("uses the edifice's own choice, else its project's", () => {
        const hiddenProject = chain({project: "hide"});
        expect(isEdificePriceOnRequest(hiddenProject.edifice, hiddenProject.scope)).toBe(true);
        const shownEdifice = chain({project: "hide", edifice: "show"});
        expect(isEdificePriceOnRequest(shownEdifice.edifice, shownEdifice.scope)).toBe(false);
        expect(isEdificePriceOnRequest({_id: id(), priceVisibility: "hide"}, emptyScope())).toBe(true);
        expect(isEdificePriceOnRequest({_id: id()}, emptyScope())).toBe(false);
    });

    it("keeps the edifice price/m² hidden even when some of its units are set to show", () => {
        const {edifice, floor, scope} = chain({edifice: "hide"});
        const shownUnit = unit(floor._id, {priceVisibility: "show"});
        expect(isUnitPriceOnRequest(shownUnit, scope)).toBe(false);
        expect(isEdificePriceOnRequest(edifice, scope)).toBe(true);
    });
});

describe("applyPriceOnRequest", () => {
    it("redacts hidden units and edifices, leaving shown ones intact", () => {
        const {floor, scope} = chain({edifice: "hide"});
        const hiddenEdifice = {
            _id: [...scope.edificeDecisions.keys()][0],
            pricePerMeterSquared: 2500,
            verandaPricePerMeterSquared: 900,
            saleCurrency: {symbol: "€"},
        };
        const openEdifice = {_id: id(), pricePerMeterSquared: 2000, verandaPricePerMeterSquared: 800};
        const hiddenUnit = unit(floor._id);
        const overriddenUnit = unit(floor._id, {priceVisibility: "show"});
        const openUnit = unit(id());

        applyPriceOnRequest(hierarchyOf([hiddenEdifice, openEdifice], [], [hiddenUnit, overriddenUnit, openUnit]), scope);

        expect(hiddenUnit.price).toBeUndefined();
        expect(hiddenUnit.priceHistory).toBeUndefined();
        expect(hiddenUnit.priceCurrency).toBeUndefined();
        expect(isPriceOnRequestRedacted(hiddenUnit)).toBe(true);

        expect(hiddenEdifice.pricePerMeterSquared).toBeUndefined();
        expect(hiddenEdifice.verandaPricePerMeterSquared).toBeUndefined();
        expect(hiddenEdifice.saleCurrency).toBeUndefined();
        expect(isPriceOnRequestRedacted(hiddenEdifice)).toBe(true);

        expect(overriddenUnit.price.toString()).toBe("150000");
        expect(isPriceOnRequestRedacted(overriddenUnit)).toBe(false);
        expect(openUnit.price.toString()).toBe("150000");
        expect(openEdifice.pricePerMeterSquared).toBe(2000);
        expect(isPriceOnRequestRedacted(openEdifice)).toBe(false);
    });
});

describe("areas are never redacted", () => {
    it("keeps every unit and edifice area on price-on-request records", () => {
        const edifice = {_id: id(), priceVisibility: "hide", totalArea: 5400, greenArea: 800, pricePerMeterSquared: 2500};
        const hiddenUnit = unit(id(), {priceVisibility: "hide", area: 95, netArea: 82, sharedArea: 9, verandaArea: 14});

        applyPriceOnRequest(hierarchyOf([edifice], [], [hiddenUnit]), emptyScope());

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
    it("matches units set to show, or not set to hide and not on a hidden floor", () => {
        const hidden = chain({edifice: "hide"});
        const shownFloor = chain({project: "hide", floor: "show"});
        const scope = buildPriceOnRequestScope({
            projects: [hidden.project, shownFloor.project],
            edifices: [hidden.edifice, shownFloor.edifice],
            floors: [hidden.floor, shownFloor.floor],
        });

        expect(priceVisibleUnitMatch(scope)).toEqual({
            $and: [{$or: [
                {priceVisibility: "show"},
                {$and: [{priceVisibility: {$ne: "hide"}}, {floor: {$nin: [hidden.floor._id]}}]},
            ]}],
        });
        expect(priceVisibleUnitExpr(scope)).toEqual({
            $or: [
                {$eq: ["$priceVisibility", "show"]},
                {$and: [{$ne: ["$priceVisibility", "hide"]}, {$not: [{$in: ["$floor", [hidden.floor._id]]}]}]},
            ],
        });
    });

    it("only checks the unit's own choice when no floor is hidden", () => {
        expect(priceVisibleUnitMatch(emptyScope())).toEqual({
            $and: [{$or: [{priceVisibility: "show"}, {$and: [{priceVisibility: {$ne: "hide"}}]}]}],
        });
    });
});
