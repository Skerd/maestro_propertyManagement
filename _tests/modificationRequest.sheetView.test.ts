/**
 * The modification request sheet shows each approval stage once it is decided (UX-10). The delivery stage used to hang
 * on `cancellationReason`, so a delivered request never showed its delivery and a cancelled one showed an empty one.
 */
import {describe, expect, it} from "vitest";
import type {ViewNode} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {modificationRequestSheetView} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.views";

function group(title: string): ViewNode {
    const found = modificationRequestSheetView.nodes.find((node) => node.props?.title === title);
    if (!found) throw new Error(`no "${title}" group`);
    return found;
}

/** Every `dependent` under a node, the node's own included. */
function dependents(node: ViewNode): string[] {
    return [...(node.dependent ? [node.dependent] : []), ...(node.children ?? []).flatMap(dependents)];
}

describe("modification request sheet", () => {
    it("shows the delivery once it is confirmed, whatever the cancellation reason", () => {
        expect(group("delivery").dependent).toBe("deliveryApproval.reviewedAt");
        expect(dependents(group("delivery"))).not.toContain("cancellationReason");
    });

    it.each(["architectApproval", "engineerApproval", "ceoApproval", "clientCostApproval"])("shows the %s stage once it is decided", (stage) => {
        expect(group(stage).dependent).toBe(`${stage}.reviewedAt`);
    });

    it("shows the finance stage once it is priced, and the cancellation only on a cancelled request", () => {
        expect(group("financeDetails").dependent).toBe("financeDetails.currency");
        expect(group("cancellation").dependent).toBe("cancellationReason");
    });
});
