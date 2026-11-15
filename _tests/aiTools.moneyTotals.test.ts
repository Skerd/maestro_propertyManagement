/** TD-B171: the PM assistant tools sum money exactly ($toDecimal) and one row per currency, never across two. */
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {getLogger} from "@coreModule/loggers/serverLog";
import type {AssistantToolContext} from "@coreModule/domain/ai/tools/assistantTool.types";
import {searchSalesTool} from "@propertyManagement/domain/ai/tools/searchSalesTool";
import {searchInstallmentsTool} from "@propertyManagement/domain/ai/tools/paymentsTools";
// Registered for the tools' populates.
import "@coreModule/database/schemas/currency/currency";
import {asTenant, dec, seedCompany, seedCurrency, seedUnit, seedUser} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;
const ctx: AssistantToolContext = {
    companyId: companyId.toString(), userId: new ObjectId().toString(), channelId: "test", audience: "internal",
    languageCode: "en-US", logger: getLogger("pm_ai_tools_test"),
};

beforeAll(async () => {
    await connectTestDatabase();
    await asCompany(async () => {
        await seedCompany(companyId, "Europe/Zurich");
        const chf = await seedCurrency(companyId, "CHF");
        const eur = await seedCurrency(companyId, "EUR");
        const buyer = await seedUser(companyId);
        const sale = async (name: string, currency: ObjectId, finalPrice: string, plan?: ObjectId) => {
            const _id = new ObjectId();
            const unit = await seedUnit(companyId, {price: finalPrice, priceCurrency: currency});
            await db().collection("sales").insertOne({
                _id, company: companyId, name, unit, buyer, saleCurrency: currency, finalPrice: dec(finalPrice), saleDate: "2026-05-02",
                paymentType: plan ? "payment_plan" : "cash", ...(plan ? {paymentPlan: plan} : {}), deletedAt: null,
            });
            return _id;
        };
        // 0.1 + 0.2 as doubles is 0.30000000000000004.
        await sale("SALE-1", chf, "0.10");
        await sale("SALE-2", chf, "0.20");
        const plan = new ObjectId();
        const planSale = await sale("SALE-3", eur, "300.00", plan);
        await db().collection("paymentplans").insertOne({
            _id: plan, company: companyId, name: "PLAN-1", sale: planSale, status: "active", deletedAt: null,
            installments: [
                {installmentNumber: 1, dueDate: "2026-05-20", amount: dec("100.10"), status: "partially_paid", paidAmount: dec("0.20")},
                {installmentNumber: 2, dueDate: "2026-06-20", amount: dec("199.90"), status: "pending"},
            ],
        });
    });
}, 120000);

afterAll(disconnectTestDatabase);

const byCurrency = <T extends {currency: string | null}>(rows: T[]) => [...rows].sort((a, b) => String(a.currency).localeCompare(String(b.currency)));

describe("PM assistant tool money (TD-B171)", {timeout: 60000}, () => {
    it("search_sales rolls revenue up exactly, per currency", async () => {
        const {revenue} = await asCompany(() => searchSalesTool.execute({}, ctx)) as {revenue: {currency: string | null}[]};
        expect(byCurrency(revenue)).toEqual([
            {currency: "CHF", amount: 0.3, sales: 2},
            {currency: "EUR", amount: 300, sales: 1},
        ]);
    });

    it("search_installments totals what is due, paid and owed per sale currency", async () => {
        const result = await asCompany(() => searchInstallmentsTool.execute({}, ctx)) as {total: number; totals: unknown};
        expect(result.total).toBe(2);
        expect(result.totals).toEqual([{currency: "EUR", amountDue: 300, amountPaid: 0.2, outstanding: 299.8}]);
    });
});
