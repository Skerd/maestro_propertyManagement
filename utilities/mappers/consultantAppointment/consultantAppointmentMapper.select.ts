import type {IConsultantAppointment} from "../../../database/schemas/consultantAppointment/consultantAppointment";

export function consultantAppointmentsToSelect(docs: IConsultantAppointment[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.title ?? doc.name,
    }));
}
