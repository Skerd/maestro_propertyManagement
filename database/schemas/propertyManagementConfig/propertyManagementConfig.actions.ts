import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import type {PropertyManagementConfig as PropertyManagementConfigDto} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/propertyManagementConfig.dto";
import PropertyManagementConfig from "./propertyManagementConfig";
import {propertyManagementConfigService} from "./propertyManagementConfig.service";
import {propertyManagementConfigToDTO} from "../../../utilities/mappers/propertyManagementConfig/propertyManagementConfigMapper.dto";

export class PropertyManagementConfigActions {
    /**
     * Get-or-create the singleton config for the authenticated company.
     * Used by the Tenancy → Configurations → Real Estate settings page.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 60},
        transaction: true,
    })
    async ensure(params: Record<string, any>): Promise<PropertyManagementConfigDto> {
        const {logger, languageCode, session, actionUserCtx, company} = params;

        logger.start(`Ensuring PropertyManagementConfig for company ${company._id}...`);

        const existing = await propertyManagementConfigService.findOne(
            {company: company._id, deletedAt: null},
            {session, logger, languageCode},
        );
        if (!existing) {
            SchemaGuard.checkModelPermission(PropertyManagementConfig, "create", actionUserCtx, languageCode);
        }

        const doc = await propertyManagementConfigService.getOrCreateForCompany(company._id, {
            session,
            logger,
            languageCode,
            auditUserId: actionUserCtx.userId,
        });

        const collected = getModelCollectedData("propertymanagementconfigs");
        const readFields = SchemaGuard.sanitizeFields(
            PropertyManagementConfig,
            collected.readFields!,
            "read",
            actionUserCtx,
            languageCode,
        );
        const populate = SchemaGuard.generatePopulate(readFields, PropertyManagementConfig.schema);
        const populated = await propertyManagementConfigService.findById(
            doc._id,
            {session, logger, languageCode},
            populate.populate,
        );

        logger.finish(`PropertyManagementConfig ready: ${doc._id}`);
        return propertyManagementConfigToDTO(populated ?? doc);
    }
}
