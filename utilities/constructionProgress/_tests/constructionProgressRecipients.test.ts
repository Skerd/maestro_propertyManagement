import {describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const db = vi.hoisted(() => ({units: [] as any[], sales: [] as any[], reservations: [] as any[], users: [] as any[]}));

const same = (a: unknown, b: unknown) => String(a) === String(b);
const inList = (v: unknown, list: unknown[]) => list.some(x => same(x, v));
const chain = (rows: any[]) => ({select: () => ({lean: async () => rows})});

vi.mock("@propertyManagement/database/schemas/unit/unit", () => ({
    default: {find: (f: any) => chain(db.units.filter(u => same(u.project, f.project) && (!f.edifice || same(u.edifice, f.edifice))))},
}));
vi.mock("@propertyManagement/database/schemas/sale/sale", () => ({
    SaleApprovalStatus: {REJECTED: "rejected"},
    default: {find: (f: any) => chain(db.sales.filter(s => inList(s._id, f._id.$in) && s.buyer != null && s.approvalStatus !== f.approvalStatus.$ne))},
}));
vi.mock("@propertyManagement/database/schemas/reservation/reservation", () => ({
    default: {find: (f: any) => chain(db.reservations.filter(r => inList(r.unit, f.unit.$in) && r.isActive === true && r.client != null))},
}));
vi.mock("@coreModule/database/schemas/user/user", () => ({
    default: {find: (f: any) => chain(db.users.filter(u => inList(u._id, f._id.$in) && inList(f.companies, u.companies) && u.isActive === f.isActive))},
}));

import {findConstructionProgressRecipients} from "../constructionProgressRecipients";

const company = new ObjectId();
const project = new ObjectId();
const edificeA = new ObjectId();
const edificeB = new ObjectId();

function user(o: Partial<any> = {}) {
    const _id = new ObjectId();
    return {_id, username: `${_id}@example.com`, name: "Ann", surname: "Lee", companies: [company], isActive: true, ...o};
}

describe("findConstructionProgressRecipients", () => {
    const buyer = user();
    const reserver = user();
    const both = user();
    const inactive = user({isActive: false});
    const rejectedBuyer = user();

    const u1 = {_id: new ObjectId(), project, edifice: edificeA, unitNumber: "A-1", sale: new ObjectId()};
    const u2 = {_id: new ObjectId(), project, edifice: edificeA, unitNumber: "A-2"};
    const u3 = {_id: new ObjectId(), project, edifice: edificeB, unitNumber: "B-1", sale: new ObjectId()};
    const u4 = {_id: new ObjectId(), project, edifice: edificeB, unitNumber: "B-2", sale: new ObjectId()};
    const u5 = {_id: new ObjectId(), project, edifice: edificeB, unitNumber: "B-3", sale: new ObjectId()};

    db.units = [u1, u2, u3, u4, u5];
    db.sales = [
        {_id: u1.sale, unit: u1._id, buyer: buyer._id},
        {_id: u3.sale, unit: u3._id, buyer: both._id, approvalStatus: "approved"},
        {_id: u4.sale, unit: u4._id, buyer: rejectedBuyer._id, approvalStatus: "rejected"},
        {_id: u5.sale, unit: u5._id, buyer: inactive._id},
    ];
    db.reservations = [
        {unit: u2._id, client: reserver._id, isActive: true},
        {unit: u2._id, client: both._id, isActive: true},
        {unit: u4._id, client: reserver._id, isActive: false},
    ];
    db.users = [buyer, reserver, both, inactive, rejectedBuyer];

    it("returns buyers and active reservation holders once each, with all their units", async () => {
        const recipients = await findConstructionProgressRecipients({company, project});
        const byId = Object.fromEntries(recipients.map(r => [r.userId, r]));

        expect(Object.keys(byId).sort()).toEqual([buyer, reserver, both].map(u => u._id.toString()).sort());
        expect(byId[both._id.toString()].units.map(u => u.unitNumber).sort()).toEqual(["A-2", "B-1"]);
        expect(byId[both._id.toString()].units.find(u => u.unitNumber === "B-1")!.relation).toBe("buyer");
        expect(byId[reserver._id.toString()].units.map(u => u.unitNumber)).toEqual(["A-2"]); // inactive reservation ignored
        expect(byId[buyer._id.toString()].email).toBe(buyer.username);
    });

    it("limits recipients to the chosen building", async () => {
        const recipients = await findConstructionProgressRecipients({company, project, edifice: edificeB});
        expect(recipients.map(r => r.userId)).toEqual([both._id.toString()]);
        expect(recipients[0].units.map(u => u.unitNumber)).toEqual(["B-1"]);
    });

    it("returns nobody for a project without units", async () => {
        expect(await findConstructionProgressRecipients({company, project: new ObjectId()})).toEqual([]);
    });
});
