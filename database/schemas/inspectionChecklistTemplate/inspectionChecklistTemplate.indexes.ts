import {Schema} from "mongoose";
import {IInspectionChecklistTemplate} from "./inspectionChecklistTemplate";

export function applyInspectionChecklistTemplateIndexes(schema: Schema<IInspectionChecklistTemplate>): void {
    schema.index({name: 1}, {unique: true});
    schema.index({status: 1});
    schema.index({project: 1, status: 1}, {sparse: true});
}
