import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import LiquidityLine, {ILiquidityLine} from "./liquidityLine";

export class LiquidityLineService extends BaseCrudService<ILiquidityLine, typeof LiquidityLine> {
    constructor() {
        super(LiquidityLine, "LiquidityLine");
    }
}

export const liquidityLineService = new LiquidityLineService();
