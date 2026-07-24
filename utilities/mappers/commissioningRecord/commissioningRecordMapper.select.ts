import type {ICommissioningRecord} from "../../../database/schemas/commissioningRecord/commissioningRecord";

export function commissioningRecordsToSelect(docs: ICommissioningRecord[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
