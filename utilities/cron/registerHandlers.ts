import {registerCronHandler} from "@coreModule/cronjobs/registry/handlerRegistry";
import {runReservationExpirationReminders} from "../../utilities/cronJobs/reservationExpirationReminderJob";
import {runPaymentPlanInstallmentReminders} from "../../utilities/cronJobs/paymentPlanInstallmentReminderJob";
import {runModificationRequestSlaEscalations} from "../../utilities/cronJobs/modificationRequestSlaJob";
import {runRentalMaintenance} from "../../utilities/cronJobs/rentalMaintenanceJob";
import {runPermitExpiryReminders} from "../../utilities/cronJobs/permitExpiryReminderJob";
import {runMilestoneSlippageReminders} from "../../utilities/cronJobs/milestoneSlippageJob";
import {runTenderDeadlineReminders} from "../../utilities/cronJobs/tenderDeadlineReminderJob";
import {runMaintenanceDue} from "../../utilities/cronJobs/maintenanceDueJob";

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
        code: "propertyManagement.permitExpiryReminder",
        handler: async ctx => {
            await runPermitExpiryReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Permit expiry reminder",
            cronExpression: "0 25 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.milestoneSlippage",
        handler: async ctx => {
            await runMilestoneSlippageReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Milestone slippage reminder",
            cronExpression: "0 30 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.tenderDeadline",
        handler: async ctx => {
            await runTenderDeadlineReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Tender deadline reminder",
            cronExpression: "0 35 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.maintenanceDue",
        handler: async ctx => {
            await runMaintenanceDue(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Maintenance due",
            cronExpression: "0 40 8 * * *",
            priority: 15,
        },
    });
}
