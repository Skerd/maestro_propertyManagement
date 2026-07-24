import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import InspectionChecklistTemplate, {IInspectionChecklistTemplate} from "./inspectionChecklistTemplate";

export class InspectionChecklistTemplateService extends BaseCrudService<IInspectionChecklistTemplate, typeof InspectionChecklistTemplate> {
    constructor() {
        super(InspectionChecklistTemplate, "InspectionChecklistTemplate");
    }
}

export const inspectionChecklistTemplateService = new InspectionChecklistTemplateService();
