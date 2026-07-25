import {ObjectId} from "mongodb";
import {BaseCrudService, CrudOptions} from "@coreModule/database/services/baseCrudService";
import Company from "@coreModule/database/schemas/company/company";
import PropertyManagementConfig, {IPropertyManagementConfig} from "./propertyManagementConfig";

export type PropertyManagementSettingsFlags = {
    requiresSaleApproval: boolean;
    requiresHandoverPackageForHandover: boolean;
};

export class PropertyManagementConfigService extends BaseCrudService<
    IPropertyManagementConfig,
    typeof PropertyManagementConfig
> {
    constructor() {
        super(PropertyManagementConfig, "PropertyManagementConfig");
    }

    /**
     * Returns the company's config, creating defaults (optionally migrated from
     * legacy Company.propertyManagementSettings) when missing.
     */
    async getOrCreateForCompany(
        companyId: ObjectId | string,
        options: CrudOptions = {},
    ): Promise<IPropertyManagementConfig> {
        const companyObjectId = typeof companyId === "string" ? new ObjectId(companyId) : companyId;
        const existing = await this.findOne(
            {company: companyObjectId, deletedAt: null},
            options,
        );
        if (existing) return existing;

        // Migrate legacy embedded Company.propertyManagementSettings if still present in BSON.
        let requiresSaleApproval = false;
        let requiresHandoverPackageForHandover = false;
        try {
            const raw = await Company.collection.findOne(
                {_id: companyObjectId},
                {projection: {propertyManagementSettings: 1}},
            );
            const legacy = (raw as any)?.propertyManagementSettings;
            if (legacy && typeof legacy === "object") {
                requiresSaleApproval = !!legacy.requiresSaleApproval;
                requiresHandoverPackageForHandover = !!legacy.requiresHandoverPackageForHandover;
            }
        } catch {
            // Best-effort migration; defaults remain false.
        }

        try {
            return await this.create(
                {
                    company: companyObjectId,
                    requiresSaleApproval,
                    requiresHandoverPackageForHandover,
                } as any,
                options,
            );
        } catch (err: unknown) {
            // Race: another request created the singleton — re-read.
            const raced = await this.findOne(
                {company: companyObjectId, deletedAt: null},
                options,
            );
            if (raced) return raced;
            throw err;
        }
    }

    async getSettingsForCompany(
        companyId: ObjectId | string,
        options: CrudOptions = {},
    ): Promise<PropertyManagementSettingsFlags> {
        const doc = await this.getOrCreateForCompany(companyId, options);
        return {
            requiresSaleApproval: !!doc.requiresSaleApproval,
            requiresHandoverPackageForHandover: !!doc.requiresHandoverPackageForHandover,
        };
    }
}

export const propertyManagementConfigService = new PropertyManagementConfigService();
