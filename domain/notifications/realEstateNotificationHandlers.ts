import {ObjectId} from "mongodb";
import {type NotificationEvent, notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {NotificationEventCodes} from "@propertyManagement/domain/notifications/notificationEventCodes";
import {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";
import {NotificationCategory} from "armonia/src/modules/core/api/user/private/notifications/notifications.enum";
import {NotificationImportance} from "@coreModule/database/schemas/notification/notification";
import {CONSTANTS} from "@coreModule/environment";

function langOpts(event: NotificationEvent) {
    return {
        languageCode: (event.payload.languageCode as string) ?? CONSTANTS.DEFAULT_LANGUAGE
    };
}

function withCurrency(amount: unknown, symbol: unknown): string | undefined {
    const a = amount != null ? String(amount) : undefined;
    const s = symbol != null ? String(symbol) : undefined;
    if (!a) return undefined;
    return s ? `${a} ${s}` : a;
}

export function registerRealEstateNotificationEventHandlers(): void {

    // ─── Reservations ──────────────────────────────────────────────────────────

    notificationEventBus.on(NotificationEventCodes.RESERVATION_CREATED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.RESERVATION_CREATED,
                        description: "Reservation created",
                        content: {
                            reservationId: payload.reservationId,
                            unitId: payload.unitId,
                            unitNumber: payload.unitNumber,
                            depositAmount: payload.depositAmount,
                            depositCurrencyId: payload.depositCurrencyId,
                            depositCurrencySymbol: payload.depositCurrencySymbol,
                            expirationDate: payload.expirationDate,
                        },
                        importance: NotificationImportance.MEDIUM,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create RESERVATION_CREATED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.RESERVATION_CANCELLED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.RESERVATION_CANCELLED,
                        description: "Reservation cancelled",
                        content: {
                            reservationId: payload.reservationId,
                            unitId: payload.unitId,
                            unitNumber: payload.unitNumber,
                            cancellationReason: payload.cancellationReason,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create RESERVATION_CANCELLED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.RESERVATION_REINSTATED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.RESERVATION_REINSTATED,
                        description: "Reservation reinstated",
                        content: {
                            reservationId: payload.reservationId,
                            unitId: payload.unitId,
                            unitNumber: payload.unitNumber,
                        },
                        importance: NotificationImportance.MEDIUM,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create RESERVATION_REINSTATED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.RESERVATION_PAID, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const amountStr = withCurrency(payload.depositAmount, payload.depositCurrencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.RESERVATION_PAID,
                        description: amountStr
                            ? `Reservation deposit paid: ${amountStr}`
                            : "Reservation deposit paid",
                        content: {
                            reservationId: payload.reservationId,
                            unitId: payload.unitId,
                            depositAmount: payload.depositAmount,
                            depositCurrencyId: payload.depositCurrencyId,
                            depositCurrencySymbol: payload.depositCurrencySymbol,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create RESERVATION_PAID notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.RESERVATION_PAYMENT_REVERSED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.RESERVATION_PAYMENT_REVERSED,
                        description: "Reservation payment reversed",
                        content: {
                            reservationId: payload.reservationId,
                            unitId: payload.unitId,
                            unitNumber: payload.unitNumber,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create RESERVATION_PAYMENT_REVERSED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.RESERVATION_EXPIRATION_REMINDER, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const phase = (payload.reminderPhase as string) || "3";
        const label =
            phase === "1" ? "Reservation ends tomorrow" : phase === "0" ? "Reservation ends today" : "Reservation ends in 3 days";

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.RESERVATION_EXPIRATION_REMINDER,
                        description: label,
                        content: {
                            reservationId: payload.reservationId,
                            unitNumber: payload.unitNumber,
                            expirationDate: payload.expirationDate,
                            reminderPhase: phase,
                        },
                        importance: phase === "0" ? NotificationImportance.HIGH : NotificationImportance.MEDIUM,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create RESERVATION_EXPIRATION_REMINDER notification for ${receiverId}:`, e);
            }
        }
    });

    // ─── Sales ─────────────────────────────────────────────────────────────────

    notificationEventBus.on(NotificationEventCodes.SALE_CREATED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const paymentType = payload.paymentType as string;
        const typeLabel = paymentType === "payment_plan" ? "Payment Plan" : "Cash";
        const priceStr = withCurrency(payload.finalPrice, payload.currencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.SALE_CREATED,
                        description: priceStr
                            ? `Unit sold (${typeLabel}): ${priceStr}`
                            : `Unit sold (${typeLabel})`,
                        content: {
                            saleId: payload.saleId,
                            unitId: payload.unitId,
                            unitNumber: payload.unitNumber,
                            finalPrice: payload.finalPrice,
                            currencySymbol: payload.currencySymbol,
                            paymentType: payload.paymentType,
                            downPayment: payload.downPayment,
                            numberOfInstallments: payload.numberOfInstallments,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create SALE_CREATED notification for ${receiverId}:`, e);
            }
        }
    });

    // ─── Payment Plans ─────────────────────────────────────────────────────────

    notificationEventBus.on(NotificationEventCodes.PAYMENT_PLAN_DOWN_PAYMENT_PAID, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const amountStr = withCurrency(payload.downPayment, payload.currencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.PAYMENT_PLAN_DOWN_PAYMENT_PAID,
                        description: amountStr
                            ? `Down payment recorded: ${amountStr}`
                            : "Down payment recorded",
                        content: {
                            paymentPlanId: payload.paymentPlanId,
                            saleId: payload.saleId,
                            downPayment: payload.downPayment,
                            currencySymbol: payload.currencySymbol,
                            remainingBalance: payload.remainingBalance,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create PAYMENT_PLAN_DOWN_PAYMENT_PAID notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.PAYMENT_PLAN_INSTALLMENT_PAID, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const installmentNumber = payload.installmentNumber as number;
        const amountStr = withCurrency(payload.paidAmount, payload.currencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.PAYMENT_PLAN_INSTALLMENT_PAID,
                        description: amountStr
                            ? `Installment #${installmentNumber} paid: ${amountStr}`
                            : `Installment #${installmentNumber} paid`,
                        content: {
                            paymentPlanId: payload.paymentPlanId,
                            saleId: payload.saleId,
                            installmentNumber,
                            paidAmount: payload.paidAmount,
                            currencySymbol: payload.currencySymbol,
                            remainingBalance: payload.remainingBalance,
                        },
                        importance: NotificationImportance.MEDIUM,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create PAYMENT_PLAN_INSTALLMENT_PAID notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.PAYMENT_PLAN_COMPLETED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const amountStr = withCurrency(payload.totalAmount, payload.currencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.PAYMENT_PLAN_COMPLETED,
                        description: amountStr
                            ? `Payment plan completed: ${amountStr}`
                            : "Payment plan completed",
                        content: {
                            paymentPlanId: payload.paymentPlanId,
                            saleId: payload.saleId,
                            totalAmount: payload.totalAmount,
                            currencySymbol: payload.currencySymbol,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create PAYMENT_PLAN_COMPLETED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.PAYMENT_PLAN_DEFAULTED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.PAYMENT_PLAN_DEFAULTED,
                        description: `Payment plan defaulted: ${payload.planName ?? payload.paymentPlanId}`,
                        content: {
                            paymentPlanId: payload.paymentPlanId,
                            saleId: payload.saleId,
                            planName: payload.planName,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create PAYMENT_PLAN_DEFAULTED notification for ${receiverId}:`, e);
            }
        }
    });

    // ─── Modification Requests ─────────────────────────────────────────────────

    notificationEventBus.on(NotificationEventCodes.MODIFICATION_REQUEST_CREATED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.MODIFICATION_REQUEST_CREATED,
                        description: "Modification request submitted",
                        content: {
                            modificationRequestId: payload.modificationRequestId,
                            title: payload.title,
                            unitId: payload.unitId,
                            unitNumber: payload.unitNumber,
                            status: payload.status,
                        },
                        importance: NotificationImportance.MEDIUM,
                        category: NotificationCategory.COMPANY,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create MODIFICATION_REQUEST_CREATED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.MODIFICATION_REQUEST_APPROVED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const stage = payload.stage as string;
        const stageLabel = stage === "architect" ? "Architect" : stage === "engineer" ? "Engineer" : "CEO";

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.MODIFICATION_REQUEST_APPROVED,
                        description: `Approved by ${stageLabel}`,
                        content: {
                            modificationRequestId: payload.modificationRequestId,
                            title: payload.title,
                            stage,
                            newStatus: payload.newStatus,
                        },
                        importance: NotificationImportance.MEDIUM,
                        category: NotificationCategory.COMPANY,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create MODIFICATION_REQUEST_APPROVED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.MODIFICATION_REQUEST_REJECTED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const stage = payload.stage as string;
        const stageLabel = stage === "architect" ? "Architect" : stage === "engineer" ? "Engineer" : "CEO";

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.MODIFICATION_REQUEST_REJECTED,
                        description: `Revision requested by ${stageLabel}`,
                        content: {
                            modificationRequestId: payload.modificationRequestId,
                            title: payload.title,
                            stage,
                            notes: payload.notes,
                            newStatus: payload.newStatus,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.COMPANY,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create MODIFICATION_REQUEST_REJECTED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.MODIFICATION_REQUEST_CANCELLED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.MODIFICATION_REQUEST_CANCELLED,
                        description: "Modification request cancelled",
                        content: {
                            modificationRequestId: payload.modificationRequestId,
                            title: payload.title,
                            cancellationReason: payload.cancellationReason,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.COMPANY,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create MODIFICATION_REQUEST_CANCELLED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.MODIFICATION_REQUEST_FINANCE_ADDED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const costStr = withCurrency(payload.totalCost, payload.currencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.MODIFICATION_REQUEST_FINANCE_ADDED,
                        description: costStr
                            ? `Finance details added: ${costStr}`
                            : "Finance details added",
                        content: {
                            modificationRequestId: payload.modificationRequestId,
                            title: payload.title,
                            totalCost: payload.totalCost,
                            currencyId: payload.currencyId,
                            currencySymbol: payload.currencySymbol,
                        },
                        importance: NotificationImportance.MEDIUM,
                        category: NotificationCategory.COMPANY,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create MODIFICATION_REQUEST_FINANCE_ADDED notification for ${receiverId}:`, e);
            }
        }
    });

    notificationEventBus.on(NotificationEventCodes.MODIFICATION_REQUEST_DELIVERED, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.MODIFICATION_REQUEST_DELIVERED,
                        description: "Modification request delivered",
                        content: {
                            modificationRequestId: payload.modificationRequestId,
                            title: payload.title,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.COMPANY,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create MODIFICATION_REQUEST_DELIVERED notification for ${receiverId}:`, e);
            }
        }
    });

    // ─── Commissions ───────────────────────────────────────────────────────────

    notificationEventBus.on(NotificationEventCodes.COMMISSION_PAID, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const opts = langOpts(event);
        const amountStr = withCurrency(payload.amount, payload.currencySymbol);

        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code: NotificationEventCodes.COMMISSION_PAID,
                        description: amountStr
                            ? `Commission paid: ${amountStr}`
                            : "Commission paid",
                        content: {
                            commissionId: payload.commissionId,
                            amount: payload.amount,
                            currencySymbol: payload.currencySymbol,
                            currencyId: payload.currencyId,
                            sourceType: payload.sourceType,
                            sourceId: payload.sourceId,
                        },
                        importance: NotificationImportance.HIGH,
                        category: NotificationCategory.FINANCIAL,
                    },
                    opts
                );
            }
            catch (e) {
                console.error(`Failed to create COMMISSION_PAID notification for ${receiverId}:`, e);
            }
        }
    });

    // ─── Project Documents ─────────────────────────────────────────────────────

    const projectDocumentEvents: {code: string; description: string; importance: NotificationImportance}[] = [
        {code: NotificationEventCodes.PROJECT_DOCUMENT_SUBMITTED_FOR_REVIEW, description: "Document submitted for review", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.PROJECT_DOCUMENT_APPROVED, description: "Document approved", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.PROJECT_DOCUMENT_REJECTED, description: "Document rejected", importance: NotificationImportance.HIGH},
        {code: NotificationEventCodes.PROJECT_DOCUMENT_SUPERSEDED, description: "Document superseded", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.PROJECT_DOCUMENT_MARKED_AS_BUILT, description: "Document marked as-built", importance: NotificationImportance.MEDIUM},
    ];

    for (const evt of projectDocumentEvents) {
        notificationEventBus.on(evt.code, async (event: NotificationEvent) => {
            const {receiverIds, payload} = event;
            const opts = langOpts(event);
            for (const receiverId of receiverIds) {
                try {
                    await createAndPushNotification(
                        {
                            receiver: new ObjectId(receiverId),
                            company: new ObjectId(payload.companyId as string),
                            code: evt.code,
                            description: evt.description,
                            content: {
                                projectDocumentId: payload.projectDocumentId,
                                title: payload.title,
                                projectId: payload.projectId,
                            },
                            importance: evt.importance,
                            category: NotificationCategory.COMPANY,
                        },
                        opts
                    );
                } catch (e) {
                    console.error(`Failed to create ${evt.code} notification for ${receiverId}:`, e);
                }
            }
        });
    }

    // ─── Permits ───────────────────────────────────────────────────────────────

    const permitEvents: {code: string; description: string; importance: NotificationImportance}[] = [
        {code: NotificationEventCodes.PERMIT_SUBMITTED, description: "Permit submitted", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.PERMIT_UNDER_REVIEW, description: "Permit under review", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.PERMIT_APPROVED, description: "Permit approved", importance: NotificationImportance.HIGH},
        {code: NotificationEventCodes.PERMIT_REJECTED, description: "Permit rejected", importance: NotificationImportance.HIGH},
        {code: NotificationEventCodes.PERMIT_RENEWED, description: "Permit renewed", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.PERMIT_EXPIRING, description: "Permit expiring soon", importance: NotificationImportance.HIGH},
    ];

    for (const evt of permitEvents) {
        notificationEventBus.on(evt.code, async (event: NotificationEvent) => {
            const {receiverIds, payload} = event;
            const opts = langOpts(event);
            for (const receiverId of receiverIds) {
                try {
                    await createAndPushNotification(
                        {
                            receiver: new ObjectId(receiverId),
                            company: new ObjectId(payload.companyId as string),
                            code: evt.code,
                            description: evt.description,
                            content: {
                                permitId: payload.permitId,
                                title: payload.title,
                                projectId: payload.projectId,
                                expiresAt: payload.expiresAt,
                            },
                            importance: evt.importance,
                            category: NotificationCategory.COMPANY,
                        },
                        opts
                    );
                } catch (e) {
                    console.error(`Failed to create ${evt.code} notification for ${receiverId}:`, e);
                }
            }
        });
    }

    // ─── Milestones ────────────────────────────────────────────────────────────

    const milestoneEvents: {code: string; description: string; importance: NotificationImportance}[] = [
        {code: NotificationEventCodes.MILESTONE_STARTED, description: "Milestone started", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.MILESTONE_COMPLETED, description: "Milestone completed", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.MILESTONE_SLIPPING, description: "Milestone slipping (overdue)", importance: NotificationImportance.HIGH},
    ];

    for (const evt of milestoneEvents) {
        notificationEventBus.on(evt.code, async (event: NotificationEvent) => {
            const {receiverIds, payload} = event;
            const opts = langOpts(event);
            for (const receiverId of receiverIds) {
                try {
                    await createAndPushNotification(
                        {
                            receiver: new ObjectId(receiverId),
                            company: new ObjectId(payload.companyId as string),
                            code: evt.code,
                            description: evt.description,
                            content: {
                                milestoneId: payload.milestoneId,
                                title: payload.title,
                                projectId: payload.projectId,
                                plannedEnd: payload.plannedEnd,
                            },
                            importance: evt.importance,
                            category: NotificationCategory.COMPANY,
                        },
                        opts
                    );
                } catch (e) {
                    console.error(`Failed to create ${evt.code} notification for ${receiverId}:`, e);
                }
            }
        });
    }

    // ─── Schedule Tasks ──────────────────────────────────────────────────────────

    const scheduleTaskEvents: {code: string; description: string; importance: NotificationImportance}[] = [
        {code: NotificationEventCodes.SCHEDULE_TASK_STARTED, description: "Task started", importance: NotificationImportance.MEDIUM},
        {code: NotificationEventCodes.SCHEDULE_TASK_COMPLETED, description: "Task completed", importance: NotificationImportance.MEDIUM},
    ];

    for (const evt of scheduleTaskEvents) {
        notificationEventBus.on(evt.code, async (event: NotificationEvent) => {
            const {receiverIds, payload} = event;
            const opts = langOpts(event);
            for (const receiverId of receiverIds) {
                try {
                    await createAndPushNotification(
                        {
                            receiver: new ObjectId(receiverId),
                            company: new ObjectId(payload.companyId as string),
                            code: evt.code,
                            description: evt.description,
                            content: {
                                scheduleTaskId: payload.scheduleTaskId,
                                title: payload.title,
                                projectId: payload.projectId,
                                milestoneId: payload.milestoneId,
                            },
                            importance: evt.importance,
                            category: NotificationCategory.COMPANY,
                        },
                        opts
                    );
                } catch (e) {
                    console.error(`Failed to create ${evt.code} notification for ${receiverId}:`, e);
                }
            }
        });
    }
}
