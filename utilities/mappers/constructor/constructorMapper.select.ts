import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IConstructor} from "../../../database/schemas/constructor/constructor";

export function constructorToSelect(constructor: IConstructor): ApiSelectDatum {
    return {
        value: constructor._id.toString(),
        label: constructor.name,
    };
}

export function constructorsToSelect(constructors: IConstructor[]): ApiSelectDatum[] {
    return constructors.map(constructorToSelect);
}
