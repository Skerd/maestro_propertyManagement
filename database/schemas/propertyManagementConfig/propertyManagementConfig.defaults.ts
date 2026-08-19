import {ObjectId} from "mongodb";
import PropertyManagementConfig from "./propertyManagementConfig";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {propertyManagementConfigSeed} from "@propertyManagement/database/seeds/operations/propertyManagementConfig.seed";

export {propertyManagementConfigSeed as defaultPropertyManagementConfig};

/**
 * Seeds the module configuration singleton.
 *
 * A unique partial index allows exactly one live document per company, so an existing
 * config is updated in place rather than a second one written under the exported id.
 */
export async function createPropertyManagementConfig(
    parentLogger: serverLogger,
    company: ICompany,
): Promise<void> {
    const logger = getLogger("mongoDbInitialization-createPropertyManagementConfig", parentLogger);
    logger.start("Creating property management configuration...");

    try {
        const [row] = propertyManagementConfigSeed;
        if (!row) {
            logger.finish("Finished creating property management configuration!");
            return;
        }

        const payload = {
            requiresSaleApproval: row.requiresSaleApproval,
            requiresHandoverPackageForHandover: row.requiresHandoverPackageForHandover,
            company: company._id,
            createdBy: company.createdBy,
        };

        const existing = await PropertyManagementConfig.findOne({company: company._id});
        if (existing) {
            existing.set(payload);
            await existing.save();
        } else {
            await PropertyManagementConfig.create({_id: new ObjectId(row.id), ...payload});
        }

        logger.finish("Finished creating property management configuration!");
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(e);
        logger.err(`Error creating property management configuration: ${message}`);
        logger.fail("Failed to create property management configuration!");
    }
}
