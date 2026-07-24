import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import MaintenancePlan, {IMaintenancePlan} from "./maintenancePlan";
export class MaintenancePlanService extends BaseCrudService<IMaintenancePlan, typeof MaintenancePlan> {
    constructor() { super(MaintenancePlan, "MaintenancePlan"); }
}
export const maintenancePlanService = new MaintenancePlanService();
