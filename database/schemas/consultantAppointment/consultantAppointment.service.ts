import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ConsultantAppointment, {IConsultantAppointment} from "./consultantAppointment";

export class ConsultantAppointmentService extends BaseCrudService<IConsultantAppointment, typeof ConsultantAppointment> {
    constructor() {
        super(ConsultantAppointment, "ConsultantAppointment");
    }
}

export const consultantAppointmentService = new ConsultantAppointmentService();
