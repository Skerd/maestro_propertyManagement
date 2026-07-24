import type {IAsset} from "../../../database/schemas/asset/asset";
export function assetsToSelect(docs: IAsset[]) { return docs.map((doc) => ({value: doc._id.toString(), label: doc.title ?? doc.name})); }
