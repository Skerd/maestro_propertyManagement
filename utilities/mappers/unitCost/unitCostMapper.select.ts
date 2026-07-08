import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {IUnitCost} from "../../../database/schemas/unitCost/unitCost";

export function unitCostToSelect(doc: IUnitCost): ApiSelectDatum {
    let label = doc.name ?? "";
    const d = doc.purchaseDate ? new Date(doc.purchaseDate).toISOString().slice(0, 10) : "";
    if (d) label = label ? `${label} · ${d}` : d;
    if (!label) label = doc._id.toString();
    return {value: doc._id.toString(), label};
}

export function unitCostsToSelect(docs: IUnitCost[]): ApiSelectDatum[] {
    return docs.map(unitCostToSelect);
}
