/**
 * UX-12: PM tables open on the columns that matter. A checklist item's fields never become columns of their parent's
 * table, review-stage fields and generated codes start hidden, and a money column carries its currency.
 */
import {describe, expect, it} from "vitest";
import {getModelCollectedData} from "@coreModule/database/collections";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import HandoverPackage from "@propertyManagement/database/schemas/handoverPackage/handoverPackage";
import InspectionChecklistTemplate from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";

type Listed = {collection: {name: string}};
/** Added to every table by the core ownership plugin, outside this module's schemas. */
const PLUGIN_COLUMNS = new Set(["createdBy", "company"]);

const columnsOf = (model: Listed) => getModelCollectedData(model.collection.name).tableConfiguration ?? [];
const visibleIds = (model: Listed) => columnsOf(model)
    .filter((column) => column.visible && !PLUGIN_COLUMNS.has(column.id))
    .map((column) => column.id);

describe("PM table columns", () => {
    it.each([
        [Inspection, "checklistItems."],
        [Sale, "handoverChecklistItems."],
        [HandoverPackage, "items."],
        [InspectionChecklistTemplate, "items."],
    ] as const)("adds no column or filter for a checklist item field (%#)", (model, prefix) => {
        const leaked = columnsOf(model).filter((column) => column.id.startsWith(prefix)).map((column) => column.id);
        expect(leaked).toEqual([]);
    });

    it("opens the modification requests table on the request, not on every review stage", () => {
        expect(visibleIds(ModificationRequest)).toEqual([
            "unit", "requestedBy", "title", "constructionType", "status", "financeDetails.totalCost", "stageDueDate",
            "submittedAt",
        ]);
        const totalCost = columnsOf(ModificationRequest).find((column) => column.id === "financeDetails.totalCost");
        expect(totalCost?.meta?.currencyPath).toBe("financeDetails.currency");
    });

    it("keeps hidden columns that cards read their tones from", () => {
        const approvalStatus = columnsOf(Sale).find((column) => column.id === "approvalStatus");
        expect(approvalStatus?.visible).toBe(false);
        expect(approvalStatus?.meta?.enumTones).toBeDefined();
        expect(visibleIds(Sale).some((id) => id.startsWith("saleApproval"))).toBe(false);
    });

    it("hides the generated codes", () => {
        expect(visibleIds(Inspection)).not.toContain("name");
        expect(visibleIds(Sale)).not.toContain("name");
        expect(visibleIds(ModificationRequest)).not.toContain("name");
    });
});
