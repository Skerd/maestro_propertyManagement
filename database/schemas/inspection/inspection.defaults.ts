import {ObjectId} from "mongodb";
import Inspection, {
    FindingSeverity,
    InspectionStatus,
    InspectionType,
    type IInspectionFindings,
} from "./inspection";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {inspectionsSeed} from "@propertyManagement/database/seeds/operations/inspections.seed";
import {
    opt,
    optDate,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";
import type {InspectionFindings} from "@propertyManagement/database/seeds/operations/types";

export {inspectionsSeed as defaultInspections};

/** Findings are exported category-by-category; media never is, so every item seeds imageless. */
function toFindings(findings: InspectionFindings): IInspectionFindings {
    const category = (items: InspectionFindings["structuralIssues"]) =>
        items.map((item) => ({
            notes: item.notes,
            media: [],
            severity: item.severity as FindingSeverity,
        }));

    return {
        structuralIssues: category(findings.structuralIssues),
        electricalIssues: category(findings.electricalIssues),
        plumbingIssues: category(findings.plumbingIssues),
        hvacIssues: category(findings.hvacIssues),
        safetyConcerns: category(findings.safetyConcerns),
        cosmeticIssues: category(findings.cosmeticIssues),
        otherObservations: category(findings.otherObservations),
    };
}

/** Seeds unit inspections — scheduled, in progress and completed, some with findings and a rating. */
export async function createInspections(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    unitIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createInspections", parentLogger);
    logger.start(`Creating inspections (${inspectionsSeed.length})...`);

    const created = new Map<string, ObjectId>();

    for (const row of inspectionsSeed) {
        try {
            const unit = unitIds.get(row.unit);
            if (!unit) {
                logger.warn(`Skipping inspection ${row.id}: its unit was not seeded.`);
                continue;
            }

            const inspectedBy = resolveUser(refs, row.inspectedBy);
            if (!inspectedBy) {
                logger.warn(
                    `Skipping inspection ${row.id}: inspector "${row.inspectedBy.$user}" not found.`,
                );
                continue;
            }

            const inspectionId = new ObjectId(row.id);
            const payload = {
                unit,
                inspectedBy,
                inspectionDate: new Date(row.inspectionDate),
                scheduledDate: new Date(row.scheduledDate),
                type: row.type as InspectionType,
                status: row.status as InspectionStatus,
                notes: row.notes,
                followUpRequired: row.followUpRequired,
                ...(row.findings ? {findings: toFindings(row.findings)} : {}),
                ...opt("rating", row.rating),
                media: [],
                ...optDate("completedAt", row.completedAt),
                ...optDate("nextInspectionDate", row.nextInspectionDate),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await Inspection.findById(inspectionId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await Inspection.create({_id: inspectionId, ...payload});
            }

            created.set(row.id, inspectionId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating inspection ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating inspections!", created.size);
    return created;
}
