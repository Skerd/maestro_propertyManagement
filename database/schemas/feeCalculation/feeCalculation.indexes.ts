import {Schema} from "mongoose";
import {IFeeCalculation} from "./feeCalculation";

export function applyFeeCalculationIndexes(schema: Schema<IFeeCalculation>): void {
    schema.index({company: 1, name: 1}, {unique: true});
    schema.index({consultantAppointment: 1, status: 1});
}
