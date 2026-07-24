import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {submitForApprovalBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/submitForApprovalBudget.form.validator";
import {approveBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/approveBudget.form.validator";
import {lockBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/lockBudget.form.validator";
import {supersedeBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/supersedeBudget.form.validator";
import {generateProgrammeFromBudgetFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/generateProgrammeFromBudget.form.validator";
import * as crypto from "crypto";
import dayjs from "dayjs";
import Budget from "./budget";
import BoqItem from "../boqItem/boqItem";
import ScheduleTask from "../scheduleTask/scheduleTask";
import CostClassification from "../costClassification/costClassification";
import {budgetService} from "./budget.service";
import {budgetToDTO} from "@propertyManagement/utilities/mappers/budget/budgetMapper.dto";

export class BudgetActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: submitForApprovalBudgetFormSchema})
    async submitForApproval(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Budget.submitForApproval ` + String(_id) + `...`);
        const existing = await budgetService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["draft"].includes(status)) {
            throw apiValidationException("invalid_status_for_submitForApproval", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "pending_approval"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await budgetService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("budgets").readFields!, Budget.schema);
            const updated = await budgetService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return budgetToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Budget.submitForApproval done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: approveBudgetFormSchema})
    async approve(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Budget.approve ` + String(_id) + `...`);
        const existing = await budgetService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["pending_approval"].includes(status)) {
            throw apiValidationException("invalid_status_for_approve", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "approved"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await budgetService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("budgets").readFields!, Budget.schema);
            const updated = await budgetService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return budgetToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Budget.approve done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: lockBudgetFormSchema})
    async lock(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Budget.lock ` + String(_id) + `...`);
        const existing = await budgetService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["approved"].includes(status)) {
            throw apiValidationException("invalid_status_for_lock", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "locked"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await budgetService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("budgets").readFields!, Budget.schema);
            const updated = await budgetService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return budgetToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Budget.lock done`);
        return undefined;
    }
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: supersedeBudgetFormSchema})
    async supersede(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, notes} = params;
        logger.start(`Budget.supersede ` + String(_id) + `...`);
        const existing = await budgetService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        const status = existing.status ?? "draft";
        if (!["locked", "approved"].includes(status)) {
            throw apiValidationException("invalid_status_for_supersede", "", null, languageCode);
        }
        const $set: Record<string, any> = {status: "superseded"};
        if (notes !== undefined && notes !== null && String(notes).trim()) {
            const prev = typeof existing.notes === "string" ? existing.notes.trim() : "";
            const next = String(notes).trim();
            $set.notes = prev ? (prev + "\n-----\n" + next) : next;
        }
        await budgetService.updateByIdOrThrow(
            existing._id,
            {$set},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("budgets").readFields!, Budget.schema);
            const updated = await budgetService.findById(existing._id, {session, logger, languageCode}, populate.populate);
            if (updated) return budgetToDTO(updated);
        } catch { /* no read */ }
        logger.finish(`Budget.supersede done`);
        return undefined;
    }

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 10}, transaction: true, schema: generateProgrammeFromBudgetFormSchema})
    async generateProgrammeFromBudget(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id} = params;
        logger.start(`Budget.generateProgrammeFromBudget ` + String(_id) + `...`);
        const budget = await budgetService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});

        // Distinct classification codes on this budget's active BoQ lines become programme tasks (BKP-structured skeleton).
        const codes: string[] = await BoqItem.distinct("classificationCode", {
            budget: budget._id, company: company._id, status: "active", deletedAt: null, classificationCode: {$nin: [null, ""]},
        }).session(session);
        if (!codes.length) {
            throw apiValidationException("budget_has_no_classified_lines", "", null, languageCode);
        }

        const titles = new Map<string, string>();
        const ccs = await CostClassification.find({company: company._id, code: {$in: codes}, deletedAt: null}).select("code title").session(session).lean();
        for (const c of ccs as any[]) titles.set(String(c.code), c.title);

        const date = dayjs().format("YYYYMMDD");
        const existing: string[] = await ScheduleTask.distinct("bkpCode", {
            project: budget.project, company: company._id, deletedAt: null, bkpCode: {$in: codes},
        }).session(session);
        const existingSet = new Set(existing.map(String));

        const toInsert = codes.filter((code) => !existingSet.has(String(code))).map((code) => ({
            name: `ST-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            project: budget.project,
            edifice: budget.edifice ?? undefined,
            title: titles.get(code) ? `${code} — ${titles.get(code)}` : `BKP ${code}`,
            bkpCode: code,
            status: "planned",
            percentComplete: 0,
            company: company._id,
            createdBy: actionUserCtx.userId,
        }));
        if (toInsert.length) {
            await ScheduleTask.insertMany(toInsert, {session});
        }

        logger.finish(`Budget.generateProgrammeFromBudget done — created ${toInsert.length} tasks`);
        try {
            const populate = SchemaGuard.generatePopulate(getModelCollectedData("budgets").readFields!, Budget.schema);
            const updated = await budgetService.findById(budget._id, {session, logger, languageCode}, populate.populate);
            if (updated) return budgetToDTO(updated);
        } catch { /* no read */ }
        return {createdTasks: toInsert.length};
    }
}
