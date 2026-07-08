import type {Model} from "mongoose";
import Project from "@propertyManagement/database/schemas/project/project";
import Edifice from "@propertyManagement/database/schemas/edifice/edifice";
import Floor from "@propertyManagement/database/schemas/floor/floor";
import UnitType from "@propertyManagement/database/schemas/unitType/unitType";
import UnitTypeCategory from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory";
import Constructor from "@propertyManagement/database/schemas/constructor/constructor";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import ModificationRequest from "@propertyManagement/database/schemas/modificationRequest/modificationRequest";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import UnitCost from "@propertyManagement/database/schemas/unitCost/unitCost";
import Reservation from "@propertyManagement/database/schemas/reservation/reservation";
import Sale from "@propertyManagement/database/schemas/sale/sale";
import PaymentPlan from "@propertyManagement/database/schemas/paymentPlan/paymentPlan";
import Commission from "@propertyManagement/database/schemas/commission/commission";
import Lead from "@propertyManagement/database/schemas/lead/lead";
import ConstructionUpdate from "@propertyManagement/database/schemas/constructionUpdate/constructionUpdate";
import Snag from "@propertyManagement/database/schemas/snag/snag";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";

export const propertyManagementModels: Model<any>[] = [
    Project,
    Edifice,
    Floor,
    Unit,
    UnitCost,
    UnitType,
    UnitTypeCategory,
    Constructor,
    Inspection,
    ModificationRequest,
    Reservation,
    Sale,
    PaymentPlan,
    Commission,
    Lead,
    ConstructionUpdate,
    Snag,
    Lease,
    RentalPayment,
];

export async function dropPropertyManagementCollections(): Promise<void> {
    for (const model of propertyManagementModels) {
        await model.collection.drop();
    }
}
