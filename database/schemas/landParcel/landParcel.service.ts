import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import LandParcel, {ILandParcel} from "./landParcel";

export class LandParcelService extends BaseCrudService<ILandParcel, typeof LandParcel> {
    constructor() {
        super(LandParcel, "LandParcel");
    }
}

export const landParcelService = new LandParcelService();
