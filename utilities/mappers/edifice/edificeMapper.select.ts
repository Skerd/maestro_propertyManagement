import {IEdifice} from "../../../database/schemas/edifice/edifice";
import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";

export function edificeToSelect(edifice: IEdifice): ApiSelectDatum {
    return {
        value: edifice._id.toString(),
        label: edifice.name,
    };
}

export function edificesToSelect(edifices: IEdifice[]): ApiSelectDatum[] {
    return edifices.map(edificeToSelect);
}
