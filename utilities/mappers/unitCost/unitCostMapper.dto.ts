import {IUnitCost} from "../../../database/schemas/unitCost/unitCost";
import {UnitCost} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {ConstructorSimple} from "armonia/src/modules/propertyManagement/dto/constructor.dto";
import type {EdificeSimple} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {FloorSimple} from "armonia/src/modules/propertyManagement/dto/floor.dto";
import type {ModificationRequestSimple} from "armonia/src/modules/propertyManagement/dto/modificationRequest.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitWithFloor} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {ConstructorSimpleSnippet} from "@propertyManagement/database/schemas/constructor/constructor.snippets";
import {EdificeSimpleSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {FloorSimpleSnippet} from "@propertyManagement/database/schemas/floor/floor.snippets";
import {ModificationRequestSimpleSnippet} from "@propertyManagement/database/schemas/modificationRequest/modificationRequest.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {
    decimalToNumber,
    mapMedia,
    mapSnippet,
} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function computeUnitCostSubtotal(doc: IUnitCost): number {
    const items = doc.expenditureItems || [];
    let sum = 0;
    for (const row of items) {
        const amt = typeof row.amount === "number" ? row.amount : parseFloat(String(row.amount));
        const ppu = decimalToNumber(row.pricePerUnit);
        if (Number.isFinite(amt) && Number.isFinite(ppu)) sum += amt * ppu;
    }
    return sum;
}

function unitCostDocRowToDto(row: {
    title?: string;
    category?: string;
    amount?: number | string;
    unit?: string;
    pricePerUnit?: unknown;
    media?: unknown[];
}) {
    const mediaRaw = row.media;
    const media =
        Array.isArray(mediaRaw) && mediaRaw.length > 0 ? mediaRaw.filter((m) => m != null).map(mapMedia) : undefined;
    return {
        title: row.title || "",
        category: row.category || "",
        amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || 0,
        unit: row.unit || "",
        pricePerUnit: decimalToNumber(row.pricePerUnit),
        ...(media && media.length > 0 ? {media} : {}),
    };
}

export function unitCostToDTO(doc: IUnitCost): UnitCost {
    const expenditureItems = (doc.expenditureItems || []).map((row) => unitCostDocRowToDto(row));
    const related = mapSnippet<ModificationRequestSimple>()(
        doc.relatedModificationRequest,
        ModificationRequestSimpleSnippet,
    );

    return {
        _id: doc._id.toString(),
        name: doc.name || "",
        unit: mapSnippet<UnitWithFloor>()(doc.unit, UnitSnippet),
        floor: mapSnippet<FloorSimple>()(doc.floor, FloorSimpleSnippet),
        edifice: mapSnippet<EdificeSimple>()(doc.edifice, EdificeSimpleSnippet),
        project: mapSnippet<ProjectSimple>()(doc.project, ProjectSimpleSnippet),
        purchasePerson: mapSnippet<SimpleBlankUser>()(doc.purchasePerson, SimpleBlankUserSnippet)!,
        purchaseDate: doc.purchaseDate ? new Date(doc.purchaseDate).toISOString() : undefined,
        paymentDate: doc.paymentDate ? new Date(doc.paymentDate).toISOString() : undefined,
        notes: doc.notes,
        verificationStatus: doc.verificationStatus || "pending_verification",
        paymentStatus: doc.paymentStatus || "unpaid",
        tag: doc.tag,
        currency: mapSnippet<CurrencySimple>()(doc.currency, CurrencySimpleSnippet),
        invoiceNumber: doc.invoiceNumber,
        vendorName: doc.vendorName,
        relatedModificationRequest: related
            ? {
                ...related,
                title: (doc.relatedModificationRequest as {title?: string} | undefined)?.title,
            }
            : undefined,
        constructorRef: mapSnippet<ConstructorSimple>()(doc.constructorRef, ConstructorSimpleSnippet),
        invoiceMedia: Array.isArray(doc.invoiceMedia) ? doc.invoiceMedia.map(mapMedia) : [],
        expenditureItems,
        documentSubtotal: computeUnitCostSubtotal(doc),
        budgetedAmount: doc.budgetedAmount != null ? decimalToNumber(doc.budgetedAmount) : undefined,
        ...mapSoftDeleteToDTO(doc),
        ...mapOwnershipToDTO(doc),
        ...mapLifeCycleToDTO(doc)
    };
}

export function unitCostsToDTO(docs: IUnitCost[]): UnitCost[] {
    return docs.map(unitCostToDTO);
}
