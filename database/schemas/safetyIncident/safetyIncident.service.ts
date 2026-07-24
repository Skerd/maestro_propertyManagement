import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import SafetyIncident, {ISafetyIncident} from "./safetyIncident";

export class SafetyIncidentService extends BaseCrudService<ISafetyIncident, typeof SafetyIncident> {
    constructor() {
        super(SafetyIncident, "SafetyIncident");
    }
}

export const safetyIncidentService = new SafetyIncidentService();
