import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({sendMail: vi.fn()}));

vi.mock("@coreModule/environment", () => ({
    EMAIL: {ENABLED: true},
    CONSTANTS: {DEFAULT_LANGUAGE: "en-US"},
    CLIENT_SIDE: {NAME: "Arpeggio"},
    clientHostFor: () => "https://panel.example",
}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({sendMail: mocks.sendMail}));

import {filteredListUrl, sendSalesStaffAlertMail, type SalesStaffAlertEmail} from "../staffAlertNotifiers";

const LOCALES = ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"];

const base = {
    email: "watcher@example.com",
    fullName: "Ann <Lee>",
    companyId: "c1",
    companyName: "Acme & Co",
    unitNumber: "A-101",
    projectName: "Riverside",
};

const cases: [string, Record<string, unknown>][] = [
    ["sale", {...base, kind: "sale_created", saleId: "s1", saleCode: "S-1", pendingApproval: false, paymentType: "cash", finalPriceDisplay: "100 €", buyerName: "Bob"}],
    ["pending sale", {...base, kind: "sale_created", saleId: "s1", pendingApproval: true, paymentType: "payment_plan"}],
    ["payment plan sale", {
        ...base, kind: "sale_created", saleId: "s2", pendingApproval: false, paymentType: "payment_plan",
        unitPriceDisplay: "120 €", localDiscountDisplay: "10%", downPaymentDisplay: "20 €", downPaymentPaid: false, numberOfInstallments: 2,
        paymentSchedule: [
            {installmentNumber: 1, dueDate: "Jan 1, 2027", amount: "50 €"},
            {installmentNumber: 2, dueDate: "Feb 1, 2027", amount: "50 €"},
        ],
    }],
    ["reservation", {...base, kind: "reservation_created", reservationId: "r1", clientName: "Cleo", depositDisplay: "5 €"}],
];

describe("sendSalesStaffAlertMail", () => {
    beforeEach(() => mocks.sendMail.mockReset().mockResolvedValue(undefined));

    for (const languageCode of LOCALES) {
        for (const [label, data] of cases) {
            it(`renders ${label} (${languageCode}) with every placeholder filled`, async () => {
                await sendSalesStaffAlertMail({...data, languageCode} as SalesStaffAlertEmail);
                expect(mocks.sendMail).toHaveBeenCalledTimes(1);
                const [companyId, mail] = mocks.sendMail.mock.calls[0];
                expect(companyId).toBe("c1");
                expect(mail.to).toBe("watcher@example.com");
                expect(mail.subject).toContain("A-101");
                expect(mail.subject).not.toMatch(/\{[a-zA-Z]+\}/);
                expect(mail.html).not.toMatch(/\{[a-zA-Z]+\}/);
                expect(mail.html).toContain("Ann &lt;Lee&gt;");
            });
        }
    }

    it("shows down payment, discount and the installment table like the buyer email", async () => {
        await sendSalesStaffAlertMail({...cases[2][1], languageCode: "en-US"} as SalesStaffAlertEmail);
        const [, mail] = mocks.sendMail.mock.calls[0];
        for (const text of ["Down payment:", "20 € (Not paid)", "Discount:", "10%", "Listing price:", "Number of installments:", "Payment schedule", "Feb 1, 2027"]) {
            expect(mail.html).toContain(text);
        }
    });

    it("links a sale to its edit page and flags pending approval", async () => {
        await sendSalesStaffAlertMail({...cases[1][1], languageCode: "en-US"} as SalesStaffAlertEmail);
        const [, mail] = mocks.sendMail.mock.calls[0];
        expect(mail.subject).toMatch(/pending approval/i);
        // No sale code on this case and no unit → plain list link.
        expect(mail.html).toContain('href="https://panel.example/realEstate/sales"');
        expect(mail.html).toContain("pending approval");
    });
});

/** Mirrors sinfonia `decodeFilterFromUrl` (filterUrl.ts): base64url → JSON FilterBuilder DSL. */
function decodeFilter(url: string) {
    const encoded = new URL(url).searchParams.get("filter")!;
    return JSON.parse(Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

describe("filteredListUrl", () => {
    it("filters the list to the record code with a valid FilterBuilder DSL", () => {
        const url = filteredListUrl("https://panel.example", "/realEstate/sales", {code: "SALE-Zürich-7", unitId: "u1"});
        expect(url.startsWith("https://panel.example/realEstate/sales?filter=")).toBe(true);
        const dsl = decodeFilter(url);
        expect(dsl).toMatchObject({operator: "and", groups: [], rules: [{field: "name", operator: "equals", value: "SALE-Zürich-7"}]});
        expect(typeof dsl.id).toBe("string");
        expect(typeof dsl.rules[0].id).toBe("string");
        expect(new URL(url).searchParams.has("qf_unit")).toBe(false);
    });

    it("falls back to the unit quick filter without a code", () => {
        const url = new URL(filteredListUrl("https://panel.example", "/realEstate/reservations", {unitId: "u1", unitLabel: "A-101"}));
        expect(url.pathname).toBe("/realEstate/reservations");
        expect(url.searchParams.get("qf_unit")).toBe("u1");
        expect(url.searchParams.get("qf_unit_label")).toBe("A-101");
    });

    it("returns no link without a panel host", () => {
        expect(filteredListUrl("", "/realEstate/sales", {code: "S-1"})).toBe("");
    });
});

describe("staff email buttons", () => {
    beforeEach(() => mocks.sendMail.mockReset().mockResolvedValue(undefined));

    it("link to the filtered sales and reservations lists", async () => {
        await sendSalesStaffAlertMail({...cases[0][1], languageCode: "en-US"} as SalesStaffAlertEmail);
        await sendSalesStaffAlertMail({...cases[3][1], reservationCode: "RES-9", languageCode: "en-US"} as SalesStaffAlertEmail);
        const hrefs = mocks.sendMail.mock.calls.map(([, m]) => /href="([^"]*realEstate[^"]*)"/.exec(m.html)![1].replace(/&amp;/g, "&"));
        expect(decodeFilter(hrefs[0]).rules[0].value).toBe("S-1");
        expect(new URL(hrefs[0]).pathname).toBe("/realEstate/sales");
        expect(decodeFilter(hrefs[1]).rules[0].value).toBe("RES-9");
        expect(new URL(hrefs[1]).pathname).toBe("/realEstate/reservations");
    });
});
