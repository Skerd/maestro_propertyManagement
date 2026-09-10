import {registerCronHandler} from "@coreModule/cronjobs/registry/handlerRegistry";
import {runReservationExpirationReminders} from "../../utilities/cronJobs/reservationExpirationReminderJob";
import {runPaymentPlanInstallmentReminders} from "../../utilities/cronJobs/paymentPlanInstallmentReminderJob";
import {runModificationRequestSlaEscalations} from "../../utilities/cronJobs/modificationRequestSlaJob";
import {runRentalMaintenance} from "../../utilities/cronJobs/rentalMaintenanceJob";
import {runLeaseRentReminders} from "../../utilities/cronJobs/leaseRentReminderJob";

export function registerPropertyManagementCronHandlers(): void {
    registerCronHandler({
        code: "propertyManagement.reservationExpirationReminder",
        handler: async ctx => {
            await runReservationExpirationReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Reservation expiration reminder",
            cronExpression: "0 10 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.paymentPlanInstallmentReminder",
        handler: async ctx => {
            await runPaymentPlanInstallmentReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Payment plan installment reminder",
            cronExpression: "0 12 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.modificationRequestSla",
        handler: async ctx => {
            await runModificationRequestSlaEscalations(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Modification request SLA escalation",
            cronExpression: "0 20 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.rentalMaintenance",
        handler: async ctx => {
            await runRentalMaintenance(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Rental payment overdue and lease expiry",
            cronExpression: "0 15 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.leaseRentReminder",
        handler: async ctx => {
            await runLeaseRentReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Lease rent reminder",
            cronExpression: "0 14 8 * * *",
            priority: 15,
        },
    });

}

