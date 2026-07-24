import {Schema} from "mongoose";
import {IAsset} from "./asset";
export function applyAssetIndexes(schema: Schema<IAsset>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({edifice: 1, lifecycleStatus: 1}, {sparse: true});
    schema.index({category: 1}, {sparse: true});
}
