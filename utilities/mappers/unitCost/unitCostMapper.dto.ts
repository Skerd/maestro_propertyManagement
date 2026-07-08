import {IUnitCost} from "../../../database/schemas/unitCost/unitCost";
import {UnitCost} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unitCost/unitCost.dto";
import {
    decimalToNumber,
    mapMedia,
    mapPopulatedRef,
    mapPopulatedSimpleCurrency,
    mapPopulatedSimpleUser
} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {Decimal128} from "mongodb";

function mapUnitRef(unit: any): UnitCost["unit"] | undefined {
    if (!unit) return undefined;
    return {
        _id: unit._id?.toString() || unit.toString(),
        name: unit.name,
        unitNumber: unit.unitNumber,
    };
}

export function computeUnitCostSubtotal(doc: IUnitCost | any): number {
    const items = doc.expenditureItems || [];
    let sum = 0;
    for (const row of items) {
        const amt = typeof row.amount === "number" ? row.amount : parseFloat(String(row.amount));
        const ppu = decimalToNumber(row.pricePerUnit);
        if (Number.isFinite(amt) && Number.isFinite(ppu)) sum += amt * ppu;
    }
    return sum;
}

function unitCostDocRowToDto(row: any) {
    const mediaRaw = row.media;
    const media =
        Array.isArray(mediaRaw) && mediaRaw.length > 0 ? mediaRaw.filter((m: unknown) => m != null).map(mapMedia) : undefined;
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
    const expenditureItems = (doc.expenditureItems || []).map((row: any) => unitCostDocRowToDto(row));

    return {
        _id: doc._id.toString(),
        name: doc.name || "",
        unit: mapUnitRef(doc.unit),
        floor: mapPopulatedRef(doc.floor),
        edifice: mapPopulatedRef(doc.edifice),
        project: mapPopulatedRef(doc.project),
        purchasePerson: mapPopulatedSimpleUser(doc.purchasePerson),
        purchaseDate: doc.purchaseDate ? new Date(doc.purchaseDate).toISOString() : undefined,
        paymentDate: doc.paymentDate ? new Date(doc.paymentDate).toISOString() : undefined,
        notes: doc.notes,
        verificationStatus: doc.verificationStatus || "pending_verification",
        paymentStatus: doc.paymentStatus || "unpaid",
        tag: doc.tag,
        currency: mapPopulatedSimpleCurrency(doc.currency),
        invoiceNumber: doc.invoiceNumber,
        vendorName: doc.vendorName,
        relatedModificationRequest: doc.relatedModificationRequest
            ? {
                  _id: doc.relatedModificationRequest._id?.toString(),
                  name: doc.relatedModificationRequest.name,
                  title: doc.relatedModificationRequest.title,
              }
            : undefined,
        invoiceMedia: Array.isArray(doc.invoiceMedia) ? doc.invoiceMedia.map(mapMedia) : [],
        expenditureItems,
        documentSubtotal: computeUnitCostSubtotal(doc),
        budgetedAmount: doc.budgetedAmount != null ? decimalToNumber(doc.budgetedAmount) : undefined,
        budgetCurrency: mapPopulatedSimpleCurrency(doc.budgetCurrency),
        ...mapSoftDeleteToDTO(doc),
        ...mapOwnershipToDTO(doc),
        ...mapLifeCycleToDTO(doc)
    };
}

export function unitCostsToDTO(docs: IUnitCost[]): UnitCost[] {
    return docs.map(unitCostToDTO);
}
