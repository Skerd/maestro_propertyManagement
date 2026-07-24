import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Budget, {IBudget} from "./budget";

export class BudgetService extends BaseCrudService<IBudget, typeof Budget> {
    constructor() {
        super(Budget, "Budget");
    }
}

export const budgetService = new BudgetService();
