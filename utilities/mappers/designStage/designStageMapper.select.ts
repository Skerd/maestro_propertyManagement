import type {IDesignStage} from "../../../database/schemas/designStage/designStage";

export function designStagesToSelect(docs: IDesignStage[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
