import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalPayment, {IRentalPayment} from "./rentalPayment";
import type {FilterQuery} from "mongoose";

export class RentalPaymentService extends BaseCrudService<IRentalPayment, typeof RentalPayment> {
    constructor() {
        super(RentalPayment, "RentalPayment");
    }

    /** Rent payments with their lease, unit and currency, for the ERP export. */
    findForErpExport(filter: FilterQuery<IRentalPayment>) {
        return this.model.find(filter)
            .select("name lease unit dueDate amount paidAmount currency status")
            .populate("lease", "name")
            .populate("unit", "name unitNumber")
            .populate("currency", "abbreviation symbol")
            .lean();
    }
}

export const rentalPaymentService = new RentalPaymentService();
