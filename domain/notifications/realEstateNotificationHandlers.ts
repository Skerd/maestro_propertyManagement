import {ObjectId} from "mongodb";
import {type NotificationEvent, notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";
import {NotificationCategory} from "armonia/src/modules/core/api/user/private/notifications/notifications.enum";
import {NotificationImportance} from "@coreModule/database/schemas/notification/notification";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger} from "@coreModule/loggers/serverLog";

const logger = getLogger("realEstate_notifications");

type Payload = Record<string, unknown>;
type Params = Record<string, string | number>;

/** The sale id under a key only the agent's copy carries, so only staff get the notice's panel link (TD-F133). */
function staffSale(p: Payload, receiverId: string): {staffSaleId?: unknown} {
    return p.buyerId && String(p.buyerId) === receiverId ? {} : {staffSaleId: p.saleId};
}

/**
 * One propertyManagement notice. `params` are the values of the code's translated message in this module's
 * `notificationTypes.json` (D117; `variant` picks a message variant); `description` is the same message in English,
 * kept as the fallback for surfaces without the translation (SMS, Telegram, other clients).
 */
type Notice = {
    code: string;
    importance: NotificationImportance;
    category: NotificationCategory;
    params: (payload: Payload, receiverId: string) => Params;
    description: (payload: Payload, receiverId: string) => string;
    content: (payload: Payload, receiverId: string) => Record<string, unknown>;
};

const {MEDIUM, HIGH} = NotificationImportance;
const {FINANCIAL, COMPANY} = NotificationCategory;

function withCurrency(amount: unknown, symbol: unknown): string | undefined {
    const a = amount != null ? String(amount) : undefined;
    const s = symbol != null ? String(symbol) : undefined;
    if (!a) return undefined;
    return s ? `${a} ${s}` : a;
}

/** A payload value as message text, or "—" when the event did not carry it. */
function text(value: unknown): string {
    return value == null || value === "" ? "—" : String(value);
}

/** Only the values that are set, so a message variant never shows an empty placeholder. */
function defined(values: Record<string, unknown>): Params {
    const out: Params = {};
    for (const [key, value] of Object.entries(values)) {
        if (value != null && value !== "") out[key] = typeof value === "number" ? value : String(value);
    }
    return out;
}

/** Variant `noX` when the optional `value` is missing, so the message leaves that part out instead of showing "—". */
function variantWithout(value: unknown, variant: string): Params {
    return value == null || value === "" ? {variant} : {};
}

const STAGE_LABEL: Record<string, string> = {architect: "Architect", engineer: "Engineer"};

const NOTICES: Notice[] = [
    // ─── Reservations ──────────────────────────────────────────────────────────
    {
        code: NotificationEventCodes.RESERVATION_CREATED, importance: MEDIUM, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber)}),
        description: () => "Reservation created",
        content: (p) => ({
            reservationId: p.reservationId, unitId: p.unitId, unitNumber: p.unitNumber, depositAmount: p.depositAmount,
            depositCurrencyId: p.depositCurrencyId, depositCurrencySymbol: p.depositCurrencySymbol, expirationDate: p.expirationDate,
        }),
    },
    {
        code: NotificationEventCodes.RESERVATION_CANCELLED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber)}),
        description: () => "Reservation cancelled",
        content: (p) => ({reservationId: p.reservationId, unitId: p.unitId, unitNumber: p.unitNumber, cancellationReason: p.cancellationReason}),
    },
    {
        code: NotificationEventCodes.RESERVATION_REINSTATED, importance: MEDIUM, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber)}),
        description: () => "Reservation reinstated",
        content: (p) => ({reservationId: p.reservationId, unitId: p.unitId, unitNumber: p.unitNumber}),
    },
    {
        code: NotificationEventCodes.RESERVATION_PAID, importance: HIGH, category: FINANCIAL,
        params: (p) => {
            const amount = withCurrency(p.depositAmount, p.depositCurrencySymbol);
            return {...defined({amount}), ...variantWithout(amount, "noAmount")};
        },
        description: (p) => {
            const amount = withCurrency(p.depositAmount, p.depositCurrencySymbol);
            return amount ? `Reservation deposit paid: ${amount}` : "Reservation deposit paid";
        },
        content: (p) => ({
            reservationId: p.reservationId, unitId: p.unitId, depositAmount: p.depositAmount,
            depositCurrencyId: p.depositCurrencyId, depositCurrencySymbol: p.depositCurrencySymbol,
        }),
    },
    {
        code: NotificationEventCodes.RESERVATION_PAYMENT_REVERSED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber)}),
        description: () => "Reservation payment reversed",
        content: (p) => ({reservationId: p.reservationId, unitId: p.unitId, unitNumber: p.unitNumber}),
    },
    {
        code: NotificationEventCodes.RESERVATION_EXPIRATION_REMINDER, importance: MEDIUM, category: FINANCIAL,
        // Phase "3" (default), "1" or "0" days before the expiry day.
        params: (p) => {
            const phase = (p.reminderPhase as string) || "3";
            return {unit: text(p.unitNumber), variant: phase === "1" ? "tomorrow" : phase === "0" ? "today" : "inThreeDays"};
        },
        description: (p) => {
            const phase = (p.reminderPhase as string) || "3";
            return phase === "1" ? "Reservation ends tomorrow" : phase === "0" ? "Reservation ends today" : "Reservation ends in 3 days";
        },
        content: (p) => ({
            reservationId: p.reservationId, unitNumber: p.unitNumber, expirationDate: p.expirationDate,
            reminderPhase: (p.reminderPhase as string) || "3",
        }),
    },

    // ─── Sales ─────────────────────────────────────────────────────────────────
    {
        code: NotificationEventCodes.SALE_CREATED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({
            unit: text(p.unitNumber),
            price: text(withCurrency(p.finalPrice, p.currencySymbol)),
            variant: p.paymentType === "payment_plan" ? "paymentPlan" : "cash",
        }),
        description: (p) => {
            const typeLabel = p.paymentType === "payment_plan" ? "Payment Plan" : "Cash";
            const price = withCurrency(p.finalPrice, p.currencySymbol);
            return price ? `Unit sold (${typeLabel}): ${price}` : `Unit sold (${typeLabel})`;
        },
        content: (p) => ({
            saleId: p.saleId, unitId: p.unitId, unitNumber: p.unitNumber, finalPrice: p.finalPrice, currencySymbol: p.currencySymbol,
            paymentType: p.paymentType, downPayment: p.downPayment, numberOfInstallments: p.numberOfInstallments,
        }),
    },
    {
        // To the agent who recorded the sale: it waits for an approver (TD-B149).
        code: NotificationEventCodes.SALE_PENDING_APPROVAL, importance: MEDIUM, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber)}),
        description: (p) => `Sale awaiting approval: Unit ${text(p.unitNumber)}`,
        content: (p) => ({saleId: p.saleId, unitId: p.unitId, unitNumber: p.unitNumber, finalPrice: p.finalPrice, paymentType: p.paymentType}),
    },
    {
        // To the agent and the buyer (TD-B149).
        code: NotificationEventCodes.SALE_APPROVED, importance: HIGH, category: FINANCIAL,
        params: () => ({}),
        description: () => "Sale approved",
        content: (p, receiverId) => ({saleId: p.saleId, decision: p.decision, ...staffSale(p, receiverId)}),
    },
    {
        // To the agent and the buyer; the sale's unit is released (TD-B149).
        code: NotificationEventCodes.SALE_REJECTED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({...defined({notes: p.notes}), ...variantWithout(p.notes, "noNotes")}),
        description: (p) => (p.notes ? `Sale rejected: ${p.notes}` : "Sale rejected"),
        content: (p, receiverId) => ({saleId: p.saleId, decision: p.decision, notes: p.notes, ...staffSale(p, receiverId)}),
    },

    // ─── Construction progress (clients of units in scope) ─────────────────────
    {
        code: NotificationEventCodes.CONSTRUCTION_PROGRESS_UPDATE, importance: MEDIUM, category: COMPANY,
        params: (p, receiverId) => {
            const units = ((p.unitLabelsByUser ?? {}) as Record<string, string[]>)[receiverId]?.join(", ");
            const place = p.edificeName ? `${p.projectName} · ${p.edificeName}` : String(p.projectName ?? "");
            return {place, percent: Number(p.progressPercent ?? 0), ...defined({units}), ...variantWithout(units, "noUnits")};
        },
        description: (p, receiverId) => {
            const units = ((p.unitLabelsByUser ?? {}) as Record<string, string[]>)[receiverId]?.join(", ");
            const place = p.edificeName ? `${p.projectName} · ${p.edificeName}` : p.projectName;
            return units
                ? `Unit ${units} (${place}) has reached ${p.progressPercent}% of works`
                : `${place} has reached ${p.progressPercent}% of works`;
        },
        content: (p, receiverId) => ({
            constructionProgressId: p.constructionProgressId, projectId: p.projectId, phase: p.phase, progressPercent: p.progressPercent,
            units: ((p.unitLabelsByUser ?? {}) as Record<string, string[]>)[receiverId] ?? [],
        }),
    },

    // ─── Staff watchers (Sales & handover → Notifications) ─────────────────────
    {
        code: NotificationEventCodes.RESERVATION_CREATED_STAFF, importance: MEDIUM, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber), ...defined({client: p.clientName}), ...variantWithout(p.clientName, "noClient")}),
        description: (p) => `New reservation: Unit ${text(p.unitNumber)}${p.clientName ? ` for ${p.clientName}` : ""}`,
        content: (p) => ({
            reservationId: p.reservationId, unitId: p.unitId, unitNumber: p.unitNumber, clientName: p.clientName,
            depositDisplay: p.depositDisplay, expirationDate: p.expirationDate,
        }),
    },
    {
        code: NotificationEventCodes.SALE_CREATED_STAFF, importance: HIGH, category: FINANCIAL,
        params: (p) => ({
            unit: text(p.unitNumber),
            ...defined({price: p.finalPriceDisplay}),
            variant: `${p.pendingApproval ? "pending" : "created"}${p.finalPriceDisplay ? "WithPrice" : ""}`,
        }),
        description: (p) => {
            const prefix = p.pendingApproval ? "New sale pending approval" : "New sale";
            const price = p.finalPriceDisplay ? ` (${p.finalPriceDisplay})` : "";
            return `${prefix}: Unit ${text(p.unitNumber)}${price}`;
        },
        content: (p) => ({
            saleId: p.saleId, unitId: p.unitId, unitNumber: p.unitNumber, finalPriceDisplay: p.finalPriceDisplay,
            buyerName: p.buyerName, soldByName: p.soldByName, pendingApproval: !!p.pendingApproval,
        }),
    },
    {
        code: NotificationEventCodes.RESERVATION_EXPIRED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({unit: text(p.unitNumber), ...defined({client: p.clientName}), ...variantWithout(p.clientName, "noClient")}),
        description: (p) => `Reservation expired: Unit ${text(p.unitNumber)}${p.clientName ? ` (${p.clientName})` : ""}`,
        content: (p) => ({
            reservationId: p.reservationId, unitId: p.unitId, unitNumber: p.unitNumber, clientName: p.clientName,
            agentName: p.agentName, expirationDate: p.expirationDate,
        }),
    },

    // ─── Payment plans ─────────────────────────────────────────────────────────
    {
        code: NotificationEventCodes.PAYMENT_PLAN_DOWN_PAYMENT_PAID, importance: HIGH, category: FINANCIAL,
        params: (p) => {
            const amount = withCurrency(p.downPayment, p.currencySymbol);
            return {...defined({amount}), ...variantWithout(amount, "noAmount")};
        },
        description: (p) => {
            const amount = withCurrency(p.downPayment, p.currencySymbol);
            return amount ? `Down payment recorded: ${amount}` : "Down payment recorded";
        },
        content: (p) => ({
            paymentPlanId: p.paymentPlanId, saleId: p.saleId, downPayment: p.downPayment, currencySymbol: p.currencySymbol,
            remainingBalance: p.remainingBalance,
        }),
    },
    {
        code: NotificationEventCodes.PAYMENT_PLAN_INSTALLMENT_PAID, importance: MEDIUM, category: FINANCIAL,
        params: (p) => {
            const amount = withCurrency(p.paidAmount, p.currencySymbol);
            return {number: text(p.installmentNumber), ...defined({amount}), ...variantWithout(amount, "noAmount")};
        },
        description: (p) => {
            const amount = withCurrency(p.paidAmount, p.currencySymbol);
            return amount ? `Installment #${p.installmentNumber} paid: ${amount}` : `Installment #${p.installmentNumber} paid`;
        },
        content: (p) => ({
            paymentPlanId: p.paymentPlanId, saleId: p.saleId, installmentNumber: p.installmentNumber, paidAmount: p.paidAmount,
            currencySymbol: p.currencySymbol, remainingBalance: p.remainingBalance,
        }),
    },
    {
        code: NotificationEventCodes.PAYMENT_PLAN_COMPLETED, importance: HIGH, category: FINANCIAL,
        params: (p) => {
            const amount = withCurrency(p.totalAmount, p.currencySymbol);
            return {...defined({amount}), ...variantWithout(amount, "noAmount")};
        },
        description: (p) => {
            const amount = withCurrency(p.totalAmount, p.currencySymbol);
            return amount ? `Payment plan completed: ${amount}` : "Payment plan completed";
        },
        content: (p) => ({paymentPlanId: p.paymentPlanId, saleId: p.saleId, totalAmount: p.totalAmount, currencySymbol: p.currencySymbol}),
    },
    {
        code: NotificationEventCodes.PAYMENT_PLAN_DEFAULTED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({plan: text(p.planName ?? p.paymentPlanId)}),
        description: (p) => `Payment plan defaulted: ${p.planName ?? p.paymentPlanId}`,
        content: (p) => ({paymentPlanId: p.paymentPlanId, saleId: p.saleId, planName: p.planName}),
    },

    // ─── Modification requests ─────────────────────────────────────────────────
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_CREATED, importance: MEDIUM, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification request submitted",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, unitId: p.unitId, unitNumber: p.unitNumber, status: p.status}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_APPROVED, importance: MEDIUM, category: COMPANY,
        // The stage ("architect", "engineer", else the CEO) is a message variant, so its name is translated too.
        params: (p) => ({title: text(p.title), variant: STAGE_LABEL[p.stage as string] ? String(p.stage) : "ceo"}),
        description: (p) => `Approved by ${STAGE_LABEL[p.stage as string] ?? "CEO"}`,
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, stage: p.stage, newStatus: p.newStatus}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_REJECTED, importance: HIGH, category: COMPANY,
        params: (p) => ({title: text(p.title), variant: STAGE_LABEL[p.stage as string] ? String(p.stage) : "ceo"}),
        description: (p) => `Revision requested by ${STAGE_LABEL[p.stage as string] ?? "CEO"}`,
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, stage: p.stage, notes: p.notes, newStatus: p.newStatus}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_CANCELLED, importance: HIGH, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification request cancelled",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, cancellationReason: p.cancellationReason}),
    },
    {
        // Emitted when finance details (the client's cost) are added (TD-B149: was a handler under an unemitted code).
        code: NotificationEventCodes.MODIFICATION_REQUEST_CLIENT_COST_PENDING, importance: MEDIUM, category: COMPANY,
        params: (p) => {
            const cost = withCurrency(p.totalCost, p.currencySymbol);
            return {title: text(p.title), ...defined({cost}), ...variantWithout(cost, "noCost")};
        },
        description: (p) => {
            const cost = withCurrency(p.totalCost, p.currencySymbol);
            return cost ? `Cost to approve: ${cost}` : "Cost to approve";
        },
        content: (p) => ({
            modificationRequestId: p.modificationRequestId, title: p.title, totalCost: p.totalCost,
            currencyId: p.currencyId, currencySymbol: p.currencySymbol,
        }),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_CLIENT_COST_APPROVED, importance: MEDIUM, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification cost approved",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, notes: p.notes, newStatus: p.newStatus}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_CLIENT_COST_REJECTED, importance: HIGH, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification cost declined",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, notes: p.notes, newStatus: p.newStatus}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_REVISION_SUBMITTED, importance: MEDIUM, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification request revised and resubmitted",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, newStatus: p.newStatus}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_REACTIVATED, importance: MEDIUM, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification request reactivated",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_SLA_BREACHED, importance: HIGH, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification request overdue at its current stage",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title, status: p.status, stageDueDate: p.stageDueDate}),
    },
    {
        code: NotificationEventCodes.MODIFICATION_REQUEST_DELIVERED, importance: HIGH, category: COMPANY,
        params: (p) => ({title: text(p.title)}),
        description: () => "Modification request delivered",
        content: (p) => ({modificationRequestId: p.modificationRequestId, title: p.title}),
    },

    // ─── Commissions ───────────────────────────────────────────────────────────
    {
        code: NotificationEventCodes.COMMISSION_PAID, importance: HIGH, category: FINANCIAL,
        params: (p) => {
            const amount = withCurrency(p.amount, p.currencySymbol);
            return {...defined({amount}), ...variantWithout(amount, "noAmount")};
        },
        description: (p) => {
            const amount = withCurrency(p.amount, p.currencySymbol);
            return amount ? `Commission paid: ${amount}` : "Commission paid";
        },
        content: (p) => ({
            commissionId: p.commissionId, amount: p.amount, currencySymbol: p.currencySymbol, currencyId: p.currencyId,
            sourceType: p.sourceType, sourceId: p.sourceId,
        }),
    },
    {
        // To the users who may approve commission payments (TD-B149).
        code: NotificationEventCodes.COMMISSION_PENDING_APPROVAL, importance: MEDIUM, category: FINANCIAL,
        params: (p) => {
            const amount = withCurrency(p.amount, p.currencySymbol);
            return {...defined({amount}), ...variantWithout(amount, "noAmount")};
        },
        description: (p) => {
            const amount = withCurrency(p.amount, p.currencySymbol);
            return amount ? `Commission payment to approve: ${amount}` : "Commission payment to approve";
        },
        content: (p) => ({
            commissionId: p.commissionId, amount: p.amount, currencySymbol: p.currencySymbol, sourceType: p.sourceType, sourceId: p.sourceId,
        }),
    },
    {
        // To the commission's agent (TD-B149).
        code: NotificationEventCodes.COMMISSION_APPROVAL_REJECTED, importance: HIGH, category: FINANCIAL,
        params: (p) => ({...defined({notes: p.notes}), ...variantWithout(p.notes, "noNotes")}),
        description: (p) => (p.notes ? `Commission payment rejected: ${p.notes}` : "Commission payment rejected"),
        content: (p) => ({commissionId: p.commissionId, notes: p.notes}),
    },
];

async function deliver(notice: Notice, event: NotificationEvent): Promise<void> {
    const {receiverIds, payload} = event;
    const languageCode = (payload.languageCode as string) ?? CONSTANTS.DEFAULT_LANGUAGE;

    for (const receiverId of receiverIds) {
        try {
            await createAndPushNotification(
                {
                    receiver: new ObjectId(receiverId),
                    company: new ObjectId(payload.companyId as string),
                    code: notice.code,
                    description: notice.description(payload, receiverId),
                    params: notice.params(payload, receiverId),
                    content: notice.content(payload, receiverId),
                    importance: notice.importance,
                    category: notice.category,
                },
                {languageCode},
            );
        }
        catch (e) {
            logger.err(`Failed to create ${notice.code} notification for ${receiverId}:`, e);
        }
    }
}

/** Every propertyManagement code has exactly one notice here (TD-B149; `notificationHandlers.test.ts` checks it). */
export function registerRealEstateNotificationEventHandlers(): void {
    for (const notice of NOTICES) {
        notificationEventBus.on(notice.code, (event: NotificationEvent) => deliver(notice, event));
    }
}
