import {Decimal128, ObjectId} from "mongodb";
import ModificationRequest, {
    ApprovalDecision,
    ConstructionType,
    ModificationRequestStatus,
    type IApprovalStage,
} from "./modificationRequest";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {modificationRequestsSeed} from "@propertyManagement/database/seeds/operations/modificationRequests.seed";
import {
    opt,
    optDate,
    resolveCurrency,
    resolveUser,
    type OperationsRefs,
} from "@propertyManagement/database/seeds/operations/operationsRefs";
import type {ApprovalStep} from "@propertyManagement/database/seeds/operations/types";

export {modificationRequestsSeed as defaultModificationRequests};

/**
 * Seeds client modification requests at every stage of the four-step approval chain.
 *
 * `stageDueDate` is not carried over: the schema's pre-save hook recomputes it from the
 * stage's SLA whenever `status` is written, so a seeded value would be overwritten on
 * create anyway — and a deadline relative to the seed run is the useful one for a demo.
 */
export async function createModificationRequests(
    parentLogger: serverLogger,
    company: ICompany,
    refs: OperationsRefs,
    unitIds: Map<string, ObjectId>,
    inspectionIds: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
    const logger = getLogger("mongoDbInitialization-createModificationRequests", parentLogger);
    logger.start(`Creating modification requests (${modificationRequestsSeed.length})...`);

    const toApprovalStage = (step: ApprovalStep): IApprovalStage =>
        ({
            decision: step.decision as ApprovalDecision,
            ...opt("user", resolveUser(refs, step.user)),
            ...opt("notes", step.notes),
            ...optDate("reviewedAt", step.reviewedAt),
            media: [],
            ...(step.materialsPlan
                ? {
                      materialsPlan: step.materialsPlan.map((item) => ({
                          item: item.item,
                          quantity: item.quantity,
                          unit: item.unit,
                          notes: item.notes,
                          pricePerUnit: Decimal128.fromString(item.pricePerUnit),
                          ...opt("currency", resolveCurrency(refs, item.currency)),
                      })),
                  }
                : {}),
            ...(step.inspections
                ? {
                      inspections: step.inspections
                          .map((id) => inspectionIds.get(id))
                          .filter((id): id is ObjectId => !!id),
                  }
                : {}),
        }) as unknown as IApprovalStage;

    const created = new Map<string, ObjectId>();

    for (const row of modificationRequestsSeed) {
        try {
            const unit = unitIds.get(row.unit);
            if (!unit) {
                logger.warn(`Skipping modification request ${row.id}: its unit was not seeded.`);
                continue;
            }

            const requestedBy = resolveUser(refs, row.requestedBy);
            if (!requestedBy) {
                logger.warn(
                    `Skipping modification request ${row.id}: requester "${row.requestedBy.$user}" not found.`,
                );
                continue;
            }

            const requestId = new ObjectId(row.id);
            const payload = {
                unit,
                requestedBy,
                title: row.title,
                description: row.description,
                constructionType: row.constructionType as ConstructionType,
                specifications: row.specifications,
                status: row.status as ModificationRequestStatus,
                architectApproval: toApprovalStage(row.architectApproval),
                engineerApproval: toApprovalStage(row.engineerApproval),
                ceoApproval: toApprovalStage(row.ceoApproval),
                deliveryApproval: toApprovalStage(row.deliveryApproval),
                ...(row.clientCostApproval
                    ? {clientCostApproval: toApprovalStage(row.clientCostApproval)}
                    : {}),
                ...(row.financeDetails
                    ? {
                          financeDetails: {
                              totalCost: row.financeDetails.totalCost,
                              ...opt("currency", resolveCurrency(refs, row.financeDetails.currency)),
                              costBreakdown: row.financeDetails.costBreakdown.map((item) => ({
                                  item: item.item,
                                  cost: item.cost,
                                  quantity: item.quantity,
                                  unit: item.unit,
                                  source: item.source,
                              })),
                              media: [],
                              notes: row.financeDetails.notes,
                              estimatedCompletionDate: new Date(
                                  row.financeDetails.estimatedCompletionDate,
                              ),
                          },
                      }
                    : {}),
                notificationSent: row.notificationSent,
                submittedAt: new Date(row.submittedAt),
                ...optDate("completedAt", row.completedAt),
                ...optDate("clientNotifiedAt", row.clientNotifiedAt),
                inspections: row.inspections
                    .map((id) => inspectionIds.get(id))
                    .filter((id): id is ObjectId => !!id),
                company: company._id,
                createdBy: company.createdBy,
            };

            const existing = await ModificationRequest.findById(requestId);
            if (existing) {
                existing.set(payload);
                await existing.save();
            } else {
                await ModificationRequest.create({_id: requestId, ...payload});
            }

            created.set(row.id, requestId);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(e);
            logger.err(`Error creating modification request ${row.id}: ${message}`);
        }
    }

    logger.finish("Finished creating modification requests!", created.size);
    return created;
}
