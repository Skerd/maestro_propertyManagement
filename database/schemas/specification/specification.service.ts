import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Specification, {ISpecification} from "./specification";

export class SpecificationService extends BaseCrudService<ISpecification, typeof Specification> {
    constructor() {
        super(Specification, "Specification");
    }
}

export const specificationService = new SpecificationService();
