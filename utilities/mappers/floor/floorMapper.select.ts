import {IFloor} from "../../../database/schemas/floor/floor";
import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";

export function floorToSelect(floor: IFloor): ApiSelectDatum {
    return {
        value: floor._id.toString(),
        label: floor.name,
    };
}

export function floorsToSelect(floors: IFloor[]): ApiSelectDatum[] {
    return floors.map(floorToSelect);
}
