import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import MaintenanceWorkOrder, {IMaintenanceWorkOrder} from "./maintenanceWorkOrder";
export class MaintenanceWorkOrderService extends BaseCrudService<IMaintenanceWorkOrder, typeof MaintenanceWorkOrder> {
    constructor() { super(MaintenanceWorkOrder, "MaintenanceWorkOrder"); }
}
export const maintenanceWorkOrderService = new MaintenanceWorkOrderService();
