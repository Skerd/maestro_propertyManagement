import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {createUnitTypes} from "@propertyManagement/database/schemas/unitType/unitType.defaults";
import {createUnitTypeCategories} from "@propertyManagement/database/schemas/unitTypeCategory/unitTypeCategory.defaults";
import {createConstructors} from "@propertyManagement/database/schemas/constructor/constructor.defaults";
import {seedPropertyManagementDemoData} from "@propertyManagement/database/demo/propertyManagementCompanyDemo";

/** Runs after core geo/currency seeds; before eCommerce category seed. */
export const companyDemoSeedOrder = 20;

export async function seedCompanyDemoData(parentLogger: serverLogger | undefined, company: any): Promise<void> {
    const logger = getLogger("propertyManagement_company_demo_seed", parentLogger);
    const categoryIds = await createUnitTypeCategories(logger, company);
    await createUnitTypes(logger, company, categoryIds);
    await createConstructors(logger, company);
    await seedPropertyManagementDemoData(logger, company);
}
