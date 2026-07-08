import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Inspection, {IInspection} from "./inspection";

export class InspectionService extends BaseCrudService<IInspection, typeof Inspection> {
    constructor() {
        super(Inspection, "Inspection");
    }
}

export const inspectionService = new InspectionService();
