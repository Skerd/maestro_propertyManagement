import {registerCronHandler} from "@coreModule/cronjobs/registry/handlerRegistry";
import {runReservationExpirationReminders} from "../../utilities/cronJobs/reservationExpirationReminderJob";
import {runPaymentPlanInstallmentReminders} from "../../utilities/cronJobs/paymentPlanInstallmentReminderJob";
import {runModificationRequestSlaEscalations} from "../../utilities/cronJobs/modificationRequestSlaJob";
import {runRentalMaintenance} from "../../utilities/cronJobs/rentalMaintenanceJob";
import {runLeaseRentReminders} from "../../utilities/cronJobs/leaseRentReminderJob";
import {runAdCampaignDispatchJob} from "../../utilities/cronJobs/adCampaignDispatchJob";
import {runAdCampaignReclaimJob} from "../../utilities/cronJobs/adCampaignReclaimJob";

export function registerPropertyManagementCronHandlers(): void {
    registerCronHandler({
        code: "propertyManagement.reservationExpirationReminder",
        handler: async ctx => {
            await runReservationExpirationReminders(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Reservation expiration reminder",
            cronExpression: "0 10 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.paymentPlanInstallmentReminder",
        handler: async ctx => {
            await runPaymentPlanInstallmentReminders(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Payment plan installment reminder",
            cronExpression: "0 12 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.modificationRequestSla",
        handler: async ctx => {
            await runModificationRequestSlaEscalations(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Modification request SLA escalation",
            cronExpression: "0 20 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.rentalMaintenance",
        handler: async ctx => {
            await runRentalMaintenance(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Rental payment overdue and lease expiry",
            cronExpression: "0 15 8 * * *",
            priority: 15,
        },
    });

    registerCronHandler({
        code: "propertyManagement.leaseRentReminder",
        handler: async ctx => {
            await runLeaseRentReminders(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Lease rent reminder",
            cronExpression: "0 14 8 * * *",
            priority: 15,
        },
    });

    // Every minute: picks up campaigns whose `scheduledAt` has arrived and
    // resumes any left mid-send. The timeout is under the 5-minute tick budget
    // so a long drain yields rather than being killed — the next tick simply
    // reclaims the campaign and continues where it stopped.
    registerCronHandler({
        code: "propertyManagement.adCampaignDispatch",
        handler: async ctx => {
            await runAdCampaignDispatchJob(ctx);
        },
        defaultJob: {
            name: "Ad campaign dispatch",
            cronExpression: "0 * * * * *",
            priority: 20,
            timeoutSeconds: 280,
        },
    });

    // Every ten minutes: frees rows and campaigns stranded by a dead worker.
    registerCronHandler({
        code: "propertyManagement.adCampaignReclaim",
        handler: async ctx => {
            await runAdCampaignReclaimJob(ctx);
        },
        defaultJob: {
            name: "Ad campaign stuck-row reclaim",
            cronExpression: "0 */10 * * * *",
            priority: 25,
        },
    });

}

