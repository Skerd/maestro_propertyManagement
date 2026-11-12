import type {InspectionWhen} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/inspection/inspection.constants";

/** The inspection list's "When" quick filter as a condition on the stored inspection day; days compare as text (GLB-09). */
export function inspectionWhenCondition(when: InspectionWhen, today: string): Record<string, unknown> {
    if (when === "upcoming") return {inspectionDate: {$gte: today}};
    if (when === "today") return {inspectionDate: today};
    return {inspectionDate: {$lt: today}};
}
