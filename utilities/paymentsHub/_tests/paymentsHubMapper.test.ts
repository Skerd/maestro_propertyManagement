import {describe, expect, it} from "vitest";
import {Decimal128, ObjectId} from "mongodb";
import {addToBuckets, bucketsToRevenue, type CurrencyBucket, planToHubRows} from "../paymentsHubMapper.dto";
import type {PaymentsHubRow} from "armonia/src/modules/propertyManagement/api/realEstate/private/paymentsHub/paymentsHub.dto";

const NOW = new Date("2026-09-22T09:00:00.000Z");
const dec = (value: string) => Decimal128.fromString(value);

const currency = {_id: new ObjectId(), name: "Euro", symbol: "€", abbreviation: "EUR"};

function makePlan(overrides: Record<string, any> = {}): Record<string, any> {
    return {
        _id: new ObjectId(),
        name: "PAYMENTS_SALE-20260101-ABC",
        status: "active",
        downPayment: dec("0"),
        downPaymentPaid: false,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        installments: [],
        sale: {
            _id: new ObjectId(),
            name: "SALE-0001",
            saleCurrency: currency,
            buyer: {_id: new ObjectId(), name: "Arta", surname: "Hoxha"},
            unit: {
                _id: new ObjectId(),
                name: "Apartment 3B",
                unitNumber: "3B",
                project: {_id: new ObjectId(), name: "Riverside"},
            },
        },
        ...overrides,
    };
}

function installment(overrides: Record<string, any> = {}): Record<string, any> {
    return {
        installmentNumber: 1,
        dueDate: new Date("2026-10-15T00:00:00.000Z"),
        amount: dec("1000"),
        status: "pending",
        ...overrides,
    };
}

describe("planToHubRows — derived status", () => {
    it("marks an unpaid installment overdue the day after it was due, whatever the stored status says", () => {
        const plan = makePlan({
            installments: [installment({dueDate: new Date("2026-09-21T00:00:00.000Z"), status: "pending"})],
        });

        const [row] = planToHubRows(plan, NOW);

        expect(row.status).toBe("overdue");
        expect(row.daysOverdue).toBe(1);
        expect(row.remaining).toBe(1000);
    });

    it("leaves an installment due today as pending", () => {
        const plan = makePlan({
            installments: [installment({dueDate: new Date("2026-09-22T00:00:00.000Z")})],
        });

        expect(planToHubRows(plan, NOW)[0].status).toBe("pending");
    });

    it("reports a part-paid overdue installment as overdue, not partially_paid", () => {
        const plan = makePlan({
            installments: [installment({
                dueDate: new Date("2026-08-15T00:00:00.000Z"),
                paidAmount: dec("400"),
                status: "partially_paid",
            })],
        });

        const [row] = planToHubRows(plan, NOW);

        expect(row.status).toBe("overdue");
        expect(row.remaining).toBe(600);
    });

    it("reports a part-paid future installment as partially_paid", () => {
        const plan = makePlan({
            installments: [installment({paidAmount: dec("400"), status: "pending"})],
        });

        expect(planToHubRows(plan, NOW)[0].status).toBe("partially_paid");
    });

    it("treats a fully covered installment as paid even when the stored status is stale", () => {
        const plan = makePlan({
            installments: [installment({
                dueDate: new Date("2026-08-15T00:00:00.000Z"),
                paidAmount: dec("1000"),
                status: "overdue",
            })],
        });

        const [row] = planToHubRows(plan, NOW);

        expect(row.status).toBe("paid");
        expect(row.remaining).toBe(0);
        expect(row.daysOverdue).toBeUndefined();
    });

    it("keeps cancelled installments cancelled and owing nothing", () => {
        const plan = makePlan({
            installments: [installment({dueDate: new Date("2026-08-15T00:00:00.000Z"), status: "cancelled"})],
        });

        const [row] = planToHubRows(plan, NOW);

        expect(row.status).toBe("cancelled");
        expect(row.remaining).toBe(0);
    });

    it("counts the late fee as part of what is still owed", () => {
        const plan = makePlan({
            installments: [installment({
                dueDate: new Date("2026-08-15T00:00:00.000Z"),
                lateFeeAmount: dec("50"),
            })],
        });

        const [row] = planToHubRows(plan, NOW);

        expect(row.remaining).toBe(1050);
        expect(row.lateFeeAmount).toBe(50);
    });

    it("falls back to the last receipt date when the installment has no paidDate", () => {
        const plan = makePlan({
            installments: [installment({
                paidAmount: dec("1000"),
                status: "paid",
                paymentReceipts: [
                    {amount: dec("600"), paidDate: new Date("2026-09-01T00:00:00.000Z")},
                    {amount: dec("400"), paidDate: new Date("2026-09-10T00:00:00.000Z")},
                ],
            })],
        });

        expect(planToHubRows(plan, NOW)[0].paidDate).toBe("2026-09-10T00:00:00.000Z");
    });
});

describe("planToHubRows — down payment", () => {
    it("adds a down-payment row due on the plan start date", () => {
        const plan = makePlan({downPayment: dec("5000"), installments: [installment()]});

        const rows = planToHubRows(plan, NOW);

        expect(rows).toHaveLength(2);
        expect(rows[0].kind).toBe("down_payment");
        expect(rows[0].dueDate).toBe("2026-01-15T00:00:00.000Z");
        expect(rows[0].amount).toBe(5000);
        // Start date is in the past and it is unpaid.
        expect(rows[0].status).toBe("overdue");
        expect(rows[0].remaining).toBe(5000);
    });

    it("marks a paid down payment paid, dated when it was made", () => {
        const plan = makePlan({
            downPayment: dec("5000"),
            downPaymentPaid: true,
            downPaymentDate: new Date("2026-01-20T00:00:00.000Z"),
        });

        const [row] = planToHubRows(plan, NOW);

        expect(row.status).toBe("paid");
        expect(row.paidAmount).toBe(5000);
        expect(row.remaining).toBe(0);
        expect(row.paidDate).toBe("2026-01-20T00:00:00.000Z");
    });

    it("adds no row when the plan has no down payment", () => {
        const rows = planToHubRows(makePlan({installments: [installment()]}), NOW);

        expect(rows.map((row) => row.kind)).toEqual(["installment"]);
    });

    it("carries unit, project, client and sale code onto every row", () => {
        const plan = makePlan({downPayment: dec("5000"), installments: [installment()]});

        for (const row of planToHubRows(plan, NOW)) {
            expect(row.unit?.unitNumber).toBe("3B");
            expect(row.project?.name).toBe("Riverside");
            expect(row.client).toMatchObject({name: "Arta", surname: "Hoxha"});
            expect(row.saleCode).toBe("SALE-0001");
            expect(row.currency?.symbol).toBe("€");
        }
    });

    it("uses the buyer company name when the sale has no personal buyer", () => {
        const plan = makePlan({
            sale: {
                ...makePlan().sale,
                buyer: undefined,
                buyerCompany: {_id: new ObjectId(), name: "Hoxha Invest sh.p.k."},
            },
            installments: [installment()],
        });

        expect(planToHubRows(plan, NOW)[0].client?.companyName).toBe("Hoxha Invest sh.p.k.");
    });

    it("cancels open rows of a cancelled plan but keeps paid ones paid", () => {
        const plan = makePlan({
            status: "cancelled",
            installments: [
                installment({installmentNumber: 1, paidAmount: dec("1000"), status: "paid"}),
                installment({installmentNumber: 2}),
            ],
        });

        const rows = planToHubRows(plan, NOW);

        expect(rows[0].status).toBe("paid");
        expect(rows[1].status).toBe("cancelled");
    });
});

describe("currency buckets", () => {
    const rowIn = (currencyId: string, symbol: string): PaymentsHubRow => ({
        _id: `${currencyId}:installment:1`,
        kind: "installment",
        status: "pending",
        planId: "plan",
        currency: {_id: currencyId, symbol},
    });

    it("keeps each currency in its own total and rounds to 2 decimals", () => {
        const map = new Map<string, CurrencyBucket>();
        addToBuckets(map, rowIn("eur", "€"), 1000.005);
        addToBuckets(map, rowIn("eur", "€"), 0.1);
        addToBuckets(map, rowIn("chf", "CHF"), 250);

        expect(bucketsToRevenue(map)).toEqual([
            {currencyId: "eur", currencyName: undefined, currencySymbol: "€", value: 1000.11},
            {currencyId: "chf", currencyName: undefined, currencySymbol: "CHF", value: 250},
        ]);
    });

    it("drops currencies that add up to nothing", () => {
        const map = new Map<string, CurrencyBucket>();
        addToBuckets(map, rowIn("eur", "€"), 0);

        expect(bucketsToRevenue(map)).toEqual([]);
    });
});
