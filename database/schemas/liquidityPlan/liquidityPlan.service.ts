import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import LiquidityPlan, {ILiquidityPlan} from "./liquidityPlan";

export class LiquidityPlanService extends BaseCrudService<ILiquidityPlan, typeof LiquidityPlan> {
    constructor() {
        super(LiquidityPlan, "LiquidityPlan");
    }
}

export const liquidityPlanService = new LiquidityPlanService();
