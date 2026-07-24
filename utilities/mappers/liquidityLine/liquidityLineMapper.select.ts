import type {ILiquidityLine} from "../../../database/schemas/liquidityLine/liquidityLine";

export function liquidityLinesToSelect(docs: ILiquidityLine[]) {
    return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name}));
}
