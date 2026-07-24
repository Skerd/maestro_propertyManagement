import type {ILiquidityPlan} from "../../../database/schemas/liquidityPlan/liquidityPlan";

export function liquidityPlansToSelect(docs: ILiquidityPlan[]) {
    return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name}));
}
