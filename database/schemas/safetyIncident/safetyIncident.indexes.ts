import {Schema} from "mongoose";
import {ISafetyIncident} from "./safetyIncident";

export function applySafetyIncidentIndexes(schema: Schema<ISafetyIncident>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
