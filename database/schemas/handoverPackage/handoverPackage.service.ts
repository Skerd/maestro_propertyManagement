import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import HandoverPackage, {IHandoverPackage} from "./handoverPackage";

export class HandoverPackageService extends BaseCrudService<IHandoverPackage, typeof HandoverPackage> {
    constructor() {
        super(HandoverPackage, "HandoverPackage");
    }
}

export const handoverPackageService = new HandoverPackageService();
