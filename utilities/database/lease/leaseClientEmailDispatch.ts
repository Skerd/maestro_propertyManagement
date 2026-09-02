import type {ClientSession} from "mongodb";
import {ObjectId} from "mongodb";
import {userService} from "@coreModule/database/schemas/user/user.service";
import type {LeaseClientEmailEvent} from "../../../kafka/types";
import {formatReservationExpirationForEmail} from "../reservation/reservationClientEmailDispatch";
import {sendLeaseClientMail} from "@propertyManagement/utilities/emails/leaseNotifiers";
import {
    formatMoneyAmountForEmail,
    unitLocationForEmail,
} from "@propertyManagement/utilities/emails/reservationEmailFormatting";
import {remainingNumber} from "@propertyManagement/utilities/lease/rentRemaining";
import type {RentReminderKind} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/sendRentReminder.form.validator";

export type DispatchLeaseClientEmailInput = Omit<
    LeaseClientEmailEvent,
    "eventType" | "email" | "userId" | "fullName" | "timestamp"
> & {
    clientUserId: string | ObjectId;
};

/**
 * Resolves current tenant email (username), then sends via SMTP (same split as sale client mail).
 * @returns true if an email was sent; false if skipped (missing tenant email).
 */
export async function dispatchLeaseClientEmail(
    input: DispatchLeaseClientEmailInput,
    opts?: {session?: ClientSession},
): Promise<boolean> {
    const id = typeof input.clientUserId === "string" ? input.clientUserId : input.clientUserId.toString();
    const user = await userService.findById(
        new ObjectId(id),
        {session: opts?.session},
        undefined,
        "username name surname fullName",
    );
    if (!user?.username) {
        return false;
    }

    const {clientUserId: _c, ...rest} = input;
    const event: LeaseClientEmailEvent = {
        eventType: "lease_client_email",
        email: user.username,
        userId: user._id.toString(),
        fullName: user.fullName || `${user.name} ${user.surname}`.trim(),
        timestamp: Date.now(),
        ...rest,
    };
    await sendLeaseClientMail(event);
    return true;
}

export function formatRentDueDateForEmail(iso: string | undefined, languageCode: string): string | undefined {
    return formatReservationExpirationForEmail(iso, languageCode);
}

export function reminderKindToDispatch(
    kind: RentReminderKind,
): Pick<DispatchLeaseClientEmailInput, "kind" | "reminderPhase"> {
    if (kind === "overdue") {
        return {kind: "rent_overdue"};
    }
    if (kind === "1d") {
        return {kind: "rent_reminder", reminderPhase: "1"};
    }
    if (kind === "0d") {
        return {kind: "rent_reminder", reminderPhase: "0"};
    }
    return {kind: "rent_reminder", reminderPhase: "3"};
}

type NamedId = {_id?: ObjectId | string} | ObjectId | string | null | undefined;

function idOf(ref: NamedId): string | undefined {
    if (ref == null) return undefined;
    if (typeof ref === "string") return ref;
    if (ref instanceof ObjectId) return ref.toString();
    if (typeof ref === "object" && "_id" in ref && ref._id != null) {
        return String(ref._id);
    }
    return undefined;
}

export function buildLeaseRentEmailPayload(params: {
    lease: {
        _id: ObjectId | string;
        name?: string;
        tenant?: NamedId;
        company?: {_id?: ObjectId | string; name?: string} | ObjectId | string;
        unit?: unknown;
    };
    payment: {
        dueDate: Date;
        amount?: unknown;
        paidAmount?: unknown;
        lateFeeAmount?: unknown;
        status?: string | null;
        currency?: {_id?: unknown; symbol?: string} | null;
        unit?: unknown;
    };
    languageCode: string;
    companyId: string;
    companyName: string;
    kind: DispatchLeaseClientEmailInput["kind"];
    reminderPhase?: DispatchLeaseClientEmailInput["reminderPhase"];
}): DispatchLeaseClientEmailInput | null {
    const tenantId = idOf(params.lease.tenant);
    if (!tenantId) {
        return null;
    }

    const unit = (params.payment.unit ?? params.lease.unit) as {
        unitNumber?: unknown;
        name?: string;
        floor?: unknown;
        edifice?: unknown;
        project?: unknown;
    } | null | undefined;
    const unitNumber = unit?.unitNumber != null ? String(unit.unitNumber) : undefined;
    const location = unitLocationForEmail(unit);

    const remaining = remainingNumber(params.payment);
    const remainingRaw = remaining.toFixed(2);
    const remainingFmt = formatMoneyAmountForEmail(remainingRaw, params.languageCode);
    const sym = params.payment.currency?.symbol ?? "";
    const rentRemainingDisplay = sym ? `${remainingFmt} ${sym}` : remainingFmt;

    const dueIso = new Date(params.payment.dueDate).toISOString();

    return {
        clientUserId: tenantId,
        languageCode: params.languageCode,
        companyId: params.companyId,
        companyName: params.companyName,
        leaseId: params.lease._id.toString(),
        leaseCode: params.lease.name,
        unitNumber,
        unitDisplayName: unit?.name,
        ...location,
        kind: params.kind,
        reminderPhase: params.reminderPhase,
        rentRemainingDisplay,
        dueDateIso: dueIso,
        dueDateFormatted: formatRentDueDateForEmail(dueIso, params.languageCode),
    };
}
