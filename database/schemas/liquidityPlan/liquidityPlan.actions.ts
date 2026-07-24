import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import dayjs from "dayjs";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {rebuildFromSourcesLiquidityPlanFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/rebuildFromSourcesLiquidityPlan.form.validator";
import LiquidityPlan from "./liquidityPlan";
import LiquidityLine from "../liquidityLine/liquidityLine";
import ContractorInvoice from "../contractorInvoice/contractorInvoice";
import {liquidityPlanService} from "./liquidityPlan.service";
import {liquidityPlanToDTO} from "@propertyManagement/utilities/mappers/liquidityPlan/liquidityPlanMapper.dto";

export class LiquidityPlanActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 20}, transaction: true, schema: rebuildFromSourcesLiquidityPlanFormSchema})
    async rebuildFromSources(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`LiquidityPlan.rebuildFromSources ` + String(_id) + `...`);
        const plan = await liquidityPlanService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});

        // Wipe previously auto-generated lines (manual lines are preserved).
        await LiquidityLine.updateMany(
            {plan: plan._id, company: company._id, source: {$ne: "manual"}, deletedAt: null},
            {$set: {deletedAt: new Date()}},
            {session},
        );

        // Outflows: contractor invoices bucketed by the month of their due date.
        const invoices = await ContractorInvoice.find({
            project: plan.project,
            company: company._id,
            deletedAt: null,
            status: {$ne: "rejected"},
        }).select("grossAmount dueDate invoiceDate").session(session).lean();

        const buckets = new Map<string, number>();
        for (const inv of invoices as any[]) {
            const when = inv.dueDate ?? inv.invoiceDate;
            if (!when) continue;
            const bucketStart = dayjs(when).startOf("month");
            const key = bucketStart.format("YYYY-MM");
            const amount = inv.grossAmount != null ? Number(inv.grossAmount.toString()) : 0;
            buckets.set(key, (buckets.get(key) ?? 0) + amount);
        }

        const date = dayjs().format("YYYYMMDD");
        const toInsert = [...buckets.entries()].map(([key, amount]) => ({
            name: `LIQL-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            plan: plan._id,
            period: dayjs(`${key}-01`).toDate(),
            direction: "outflow",
            source: "contractor_invoice",
            title: `Contractor invoices ${key}`,
            plannedAmount: amount,
            currency: plan.currency,
            company: company._id,
            createdBy: actionUserCtx.userId,
        }));
        if (toInsert.length) {
            await LiquidityLine.insertMany(toInsert, {session});
        }

        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("liquidityplans").readFields!, LiquidityPlan.schema);
            const updated = await liquidityPlanService.findById(plan._id, {session, logger, languageCode}, populate.populate);
            if (updated) return liquidityPlanToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`LiquidityPlan.rebuildFromSources done — ${toInsert.length} outflow lines`);
        return undefined;
    }
}
