import {Schema} from "mongoose";

/**
 * Optimized indexes for inspection queries.
 */
export function applyInspectionIndexes(InspectionSchema: Schema): void {
    InspectionSchema.index({ name: 1 }, { unique: true });
    InspectionSchema.index({ unit: 1, inspectionDate: -1 });
    InspectionSchema.index({ inspectedBy: 1, status: 1 });
    InspectionSchema.index({ status: 1, scheduledDate: 1 });
    InspectionSchema.index({ followUpRequired: 1, nextInspectionDate: 1 });
    InspectionSchema.index({ followUpInspection: 1 });
    InspectionSchema.index({ followedUpByInspection: 1 });
    InspectionSchema.index({ inspectionDate: -1 });
    InspectionSchema.index({ type: 1, status: 1 });
    InspectionSchema.index({ unit: 1, type: 1 });
    InspectionSchema.index({ unit: 1, status: 1, inspectionDate: -1 });
    InspectionSchema.index({ inspectedBy: 1, inspectionDate: -1 });
    InspectionSchema.index({ status: 1, inspectionDate: -1 });
    InspectionSchema.index({ type: 1, inspectionDate: -1 });
    InspectionSchema.index({ followUpRequired: 1, status: 1, nextInspectionDate: 1 });
    InspectionSchema.index({ inspectionDate: 1, status: 1 });
    InspectionSchema.index({ scheduledDate: 1, status: 1 });
    InspectionSchema.index({ status: 1, completedAt: -1 });
    InspectionSchema.index({ unit: 1, completedAt: -1 });

    // Client sign-off reporting: find inspections signed by clients, scoped to company
    InspectionSchema.index({ clientSignedAt: 1, company: 1 });
}
