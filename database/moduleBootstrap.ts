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
import Story from "@propertyManagement/database/schemas/story/story";
import StoryType from "@propertyManagement/database/schemas/storyType/storyType";
import Lease from "@propertyManagement/database/schemas/lease/lease";
import RentalPayment from "@propertyManagement/database/schemas/rentalPayment/rentalPayment";
import HandoverPackage from "@propertyManagement/database/schemas/handoverPackage/handoverPackage";
import InspectionChecklistTemplate from "@propertyManagement/database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import PropertyManagementConfig from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig";
import DashboardCache from "@propertyManagement/database/schemas/dashboardCache/dashboardCache";
import {realEstateDefaultRoles} from "@propertyManagement/database/schemas/role/realEstate.role.defaults";
import {registerDefaultRoles} from "@coreModule/database/schemas/role/role.defaults";

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
    StoryType,
    Story,
    Lease,
    RentalPayment,
    HandoverPackage,
    InspectionChecklistTemplate,
    PropertyManagementConfig,
    DashboardCache,
];

export async function dropPropertyManagementCollections(): Promise<void> {
    for (const model of propertyManagementModels) {
        await model.collection.drop();
    }
}

registerDefaultRoles(realEstateDefaultRoles);

export const moduleBootstrap = {
    models: propertyManagementModels,
    dropModuleCollections: dropPropertyManagementCollections,
    defaultRoles: realEstateDefaultRoles,
};
