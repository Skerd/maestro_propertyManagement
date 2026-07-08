import {registerCronHandler} from "@coreModule/cronjobs/registry/handlerRegistry";
import {runReservationExpirationReminders} from "../../utilities/cronJobs/reservationExpirationReminderJob";
import {runPaymentPlanInstallmentReminders} from "../../utilities/cronJobs/paymentPlanInstallmentReminderJob";
import {runModificationRequestSlaEscalations} from "../../utilities/cronJobs/modificationRequestSlaJob";
import {runRentalMaintenance} from "../../utilities/cronJobs/rentalMaintenanceJob";

export function registerPropertyManagementCronHandlers(): void {
    registerCronHandler({
        code: "propertyManagement.reservationExpirationReminder",
        handler: async ctx => {
            await runReservationExpirationReminders(ctx.logger);
        },
        version: "1",
    });

    registerCronHandler({
        code: "propertyManagement.paymentPlanInstallmentReminder",
        handler: async ctx => {
            await runPaymentPlanInstallmentReminders(ctx.logger);
        },
        version: "1",
    });

    registerCronHandler({
        code: "propertyManagement.modificationRequestSla",
        handler: async ctx => {
            await runModificationRequestSlaEscalations(ctx.logger);
        },
        version: "1",
    });

    registerCronHandler({
        code: "propertyManagement.rentalMaintenance",
        handler: async ctx => {
            await runRentalMaintenance(ctx.logger);
        },
        version: "1",
    });
}
