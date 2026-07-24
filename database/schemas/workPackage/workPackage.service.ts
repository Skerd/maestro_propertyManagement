import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import WorkPackage, {IWorkPackage} from "./workPackage";

export class WorkPackageService extends BaseCrudService<IWorkPackage, typeof WorkPackage> {
    constructor() {
        super(WorkPackage, "WorkPackage");
    }
}

export const workPackageService = new WorkPackageService();
