/**
 * Fixtures for the propertyManagement sale tests: a tenant, its staff and the records a sale points at (currencies,
 * a unit, a reservation), inserted raw because the tests are about the sale rules, not those records' own forms.
 * The unit carries every required field, since releasing a sale saves it.
 */
import mongoose from "mongoose";
import {Decimal128, ObjectId} from "mongodb";
import {getLogger} from "@coreModule/loggers/serverLog";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import type {UserContext} from "@coreModule/utilities/types/types";
import {UnitStatus} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

export const dec = (value: string): Decimal128 => Decimal128.fromString(value);

/** A stored Decimal128 (or a missing one) as its exact string. */
export const decString = (value: unknown): string | undefined => (value == null ? undefined : String(value));

const db = () => mongoose.connection.db!;

/** Runs `fn` as `companyId`'s request or job would (D16). */
export const asTenant = (companyId: ObjectId) => <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);

/** The parameters an `@action` receives for `companyId`, minus the body; `permissions` decide what it reads back. */
export function actor(companyId: ObjectId, permissions: string[] = []) {
    const actionUserCtx: UserContext = {userId: new ObjectId().toString(), orgId: companyId.toString(), isAdmin: true, permissions, isSelf: true};
    return {logger: getLogger("pm_sale_test"), languageCode: "en-US", company: {_id: companyId, name: "Test company"}, actionUserCtx};
}

export async function clearDatabase(): Promise<void> {
    for (const collection of await db().collections()) {
        await collection.deleteMany({});
    }
}

export async function seedCurrency(companyId: ObjectId, abbreviation: string, decimalPlaces = 2): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("currencies").insertOne({_id, name: abbreviation, symbol: abbreviation, abbreviation, decimalPlaces, company: companyId, deletedAt: null});
    return _id;
}

/** A user who belongs to `companyId` (buyer, seller). */
export async function seedUser(companyId: ObjectId, name = "Ana"): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("users").insertOne({
        _id, name, surname: "Test", username: `${name.toLowerCase()}-${_id.toString().slice(-6)}@example.com`,
        roles: [{company: companyId, active: "active", roles: [], rolesCount: 0, unsuccessfulLogins: 0, lockedOutUntil: null, lastLogin: null}],
        deletedAt: null,
    });
    return _id;
}

export async function seedUnit(companyId: ObjectId, input: {price: string; priceCurrency: ObjectId; status?: string; reservation?: ObjectId; sale?: ObjectId; saleCommissionRatePercent?: number}): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("units").insertOne({
        _id, company: companyId, unitType: new ObjectId(), floor: new ObjectId(),
        unitNumber: `U-${_id.toString().slice(-4)}`, name: "Apartment", area: 80, sharedArea: 10, netArea: 70,
        price: dec(input.price), priceCurrency: input.priceCurrency,
        hasBalcony: false, hasTerrace: false, hasSeaView: false, hasCityView: false, hasLakeView: false, hasElevator: true,
        numberOfRooms: 3, numberOfBathrooms: 1,
        status: input.status ?? UnitStatus.AVAILABLE,
        ...(input.reservation ? {reservation: input.reservation} : {}),
        ...(input.sale ? {sale: input.sale} : {}),
        ...(input.saleCommissionRatePercent !== undefined ? {saleCommissionRatePercent: input.saleCommissionRatePercent} : {}),
        deletedAt: null,
    });
    return _id;
}

export async function seedReservation(companyId: ObjectId, input: {unit: ObjectId; client: ObjectId; depositAmount?: string; depositCurrency?: ObjectId; paid?: boolean; status?: string; isActive?: boolean}): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("reservations").insertOne({
        _id, company: companyId, unit: input.unit, reservedBy: input.client, reservedByCompany: companyId, client: input.client,
        name: `RES-${_id.toString().slice(-6)}`,
        reservationDate: new Date("2026-01-10T00:00:00.000Z"), expirationDate: new Date("2026-12-31T00:00:00.000Z"),
        ...(input.depositAmount ? {depositAmount: dec(input.depositAmount), depositCurrency: input.depositCurrency} : {}),
        paid: input.paid ?? true, isActive: input.isActive ?? true, status: input.status ?? "active",
        deletedAt: null,
    });
    return _id;
}

/** A unit reserved by a paid reservation, the way the reservation flow leaves them. */
export async function seedReservedUnit(companyId: ObjectId, input: {price: string; priceCurrency: ObjectId; depositAmount: string; depositCurrency: ObjectId; client: ObjectId}) {
    const unitId = await seedUnit(companyId, {price: input.price, priceCurrency: input.priceCurrency, status: UnitStatus.RESERVED});
    const reservationId = await seedReservation(companyId, {unit: unitId, client: input.client, depositAmount: input.depositAmount, depositCurrency: input.depositCurrency});
    await db().collection("units").updateOne({_id: unitId}, {$set: {reservation: reservationId}});
    return {unitId, reservationId};
}

export const findRaw = (collection: string, _id: ObjectId) => db().collection(collection).findOne({_id});

/** The tenant's company record, with the timezone its business "today" is taken in (D91). */
export async function seedCompany(companyId: ObjectId, timezone: string): Promise<void> {
    await db().collection("companies").insertOne({_id: companyId, name: "Test company", timezone, deletedAt: null});
}

/** An active lease on `unit`, monthly rent in `currency`; calendar dates are stored at midnight UTC. */
export async function seedLease(companyId: ObjectId, input: {unit: ObjectId; tenant: ObjectId; currency: ObjectId; startDate: string; endDate: string; monthlyRent?: string; gracePeriodDays?: number; status?: string}): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("leases").insertOne({
        _id, company: companyId, name: `LEASE-${_id.toString().slice(-6)}`, unit: input.unit, tenant: input.tenant,
        startDate: new Date(input.startDate), endDate: new Date(input.endDate),
        monthlyRent: dec(input.monthlyRent ?? "1000.00"), rentCurrency: input.currency,
        gracePeriodDays: input.gracePeriodDays ?? 0, depositPaid: false, status: input.status ?? "active",
        deletedAt: null,
    });
    return _id;
}

/** One month's rent row of `lease`. */
export async function seedRentRow(companyId: ObjectId, input: {lease: ObjectId; unit: ObjectId; currency: ObjectId; dueDate: string; amount?: string; status?: string; paidAmount?: string}): Promise<ObjectId> {
    const _id = new ObjectId();
    await db().collection("rentalpayments").insertOne({
        _id, company: companyId, lease: input.lease, unit: input.unit, dueDate: new Date(input.dueDate),
        amount: dec(input.amount ?? "1000.00"), currency: input.currency, status: input.status ?? "pending",
        ...(input.paidAmount ? {paidAmount: dec(input.paidAmount), paymentReceipts: [{amount: dec(input.paidAmount), paidDate: new Date(input.dueDate)}]} : {}),
        deletedAt: null,
    });
    return _id;
}
