import type {ILandParcel} from "../../../database/schemas/landParcel/landParcel";

export function landParcelsToSelect(docs: ILandParcel[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
