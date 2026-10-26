import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import {
    companyAddressCities,
    portalCompanyRefs,
    portalListedCompanyIds,
} from "@coreModule/utilities/marketing/portalCompanies";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {publicMediaUrl} from "@coreModule/utilities/media/publicMediaUrl";
import PropertyManagementConfig from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig";
import Project from "@propertyManagement/database/schemas/project/project";

/** Real-estate companies on the portal: opted in on their property management settings. */
export function propertiesPortalCompanyIds() {
    return portalListedCompanyIds("propertyManagement", {
        configModel: PropertyManagementConfig,
        configFilter: {listedOnPortal: true},
    });
}

export function propertiesPortalPath(slug: string): string {
    return `/properties/${slug}`;
}

/** The properties section of the portal: companies by their own cities, projects by name. */
export function registerPropertiesPortalProvider(): void {
    registerPortalProvider({
        key: "properties",
        order: 40,
        companyPath: (company) => propertiesPortalPath(company.slug),
        listedCompanyIds: propertiesPortalCompanyIds,
        citiesByCompany: companyAddressCities,
        async search({query, companyIds, limit}) {
            const projects = await Project.find({
                company: {$in: companyIds},
                deletedAt: null,
                name: {$regex: escapeRegex(query), $options: "i"},
            }).select("company name mainImage").sort({name: 1}).limit(limit).lean();
            const companies = await portalCompanyRefs(projects.map((project) => project.company as any));
            return projects.flatMap((project) => {
                const company = companies.get(String(project.company));
                return company ? [{
                    kind: "project",
                    title: project.name,
                    subtitle: company.name,
                    image: publicMediaUrl(project.mainImage),
                    path: `${propertiesPortalPath(company.slug)}/project?projectId=${project._id}`,
                    company,
                }] : [];
            });
        },
    });
}
