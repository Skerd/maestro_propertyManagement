import type {IFeeCalculation} from "../../../database/schemas/feeCalculation/feeCalculation";

export function feeCalculationsToSelect(docs: IFeeCalculation[]) {
    return docs.map((doc) => ({value: doc._id.toString(), label: doc.name}));
}
