/**
 * Daily job (§3.Q):
 * - Finds active MaintenancePlans whose nextDueAt has passed and spawns a preventive
 *   MaintenanceWorkOrder for each, then advances nextDueAt by intervalDays.
 *
 * @module utilities/cronJobs/maintenanceDueJob
 */

import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import dayjs from "dayjs";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import MaintenancePlan from "../../database/schemas/maintenancePlan/maintenancePlan";
import MaintenanceWorkOrder from "../../database/schemas/maintenanceWorkOrder/maintenanceWorkOrder";

const BATCH_SIZE = 200;

export async function runMaintenanceDue(parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("maintenance_due", parentLogger);
    logger.start("Checking due maintenance plans...");
    const now = new Date();
    let spawned = 0;

    let lastId: ObjectId | undefined;
    while (true) {
        const filter: Record<string, unknown> = {
            active: true,
            nextDueAt: {$exists: true, $ne: null, $lte: now},
            deletedAt: null,
        };
        if (lastId) filter._id = {$gt: lastId};
        const plans = await MaintenancePlan.find(filter).sort({_id: 1}).limit(BATCH_SIZE).lean();
        if (plans.length === 0) break;
        lastId = plans[plans.length - 1]._id as ObjectId;

        for (const plan of plans as any[]) {
            try {
                const date = dayjs().format("YYYYMMDD");
                await MaintenanceWorkOrder.create({
                    name: `MWO-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
                    plan: plan._id,
                    asset: plan.asset ?? undefined,
                    edifice: plan.edifice ?? undefined,
                    title: plan.title,
                    type: plan.planType === "renovation" ? "renovation" : "preventive",
                    dueDate: plan.nextDueAt ?? undefined,
                    status: "open",
                    company: plan.company,
                    createdBy: plan.createdBy,
                });
                const nextDue = plan.intervalDays && plan.nextDueAt
                    ? dayjs(plan.nextDueAt).add(Number(plan.intervalDays), "day").toDate()
                    : dayjs(now).add(1, "year").toDate();
                await MaintenancePlan.updateOne({_id: plan._id}, {$set: {nextDueAt: nextDue}});
                spawned++;
            } catch (e: unknown) {
                logger.err(`Maintenance work order spawn failed for plan ${plan._id?.toString?.()}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        if (plans.length < BATCH_SIZE) break;
    }

    logger.finish(`Maintenance due check complete. Spawned ${spawned} work order(s).`);
}
