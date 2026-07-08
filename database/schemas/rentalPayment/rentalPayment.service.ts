import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalPayment, {IRentalPayment} from "./rentalPayment";

export class RentalPaymentService extends BaseCrudService<IRentalPayment, typeof RentalPayment> {
    constructor() {
        super(RentalPayment, "RentalPayment");
    }
}

export const rentalPaymentService = new RentalPaymentService();
