import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalBrowseParams} from "@coreModule/domain/portal/portalProvider.types";
import {catalogItems, filterValue} from "@coreModule/domain/portal/portalCatalog";
import {companyAddressCities, portalListedCompanyIds, type PortalScope} from "@coreModule/utilities/marketing/portalCompanies";
import {
    MARKETING_BEDROOM_FILTERS,
    MARKETING_PROPERTY_TYPE_IDS,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.shared.types";
import type {MarketingProjectCatalogListItem} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.response.type";
import PropertyManagementConfig from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig";
import {loadMarketingProjectsCatalog} from "@propertyManagement/utilities/marketing/marketingProjectsCatalog.util";

/** Real-estate companies with property management (and on the apex, opted in on its settings). */
export function propertiesPortalCompanyIds(scope: PortalScope) {
    return portalListedCompanyIds("propertyManagement", {
        configModel: PropertyManagementConfig,
        listedOn: {listedOnPortal: true},
    }, scope);
}

/**
 * The companies' projects as their public catalog lists them, narrowed by the catalog's own
 * filters (`f.propertyType`, `f.bedrooms`, `f.areaSqmMin`); each opens the project's page.
 */
async function browseProjects({companyIds, query, priceMin, priceMax, sort, skip, limit, filters, languageCode}: PortalBrowseParams) {
    const propertyType = MARKETING_PROPERTY_TYPE_IDS.find((type) => type === filterValue(filters, "propertyType"));
    const bedrooms = MARKETING_BEDROOM_FILTERS.find((option) => option === filterValue(filters, "bedrooms"));
    const areaSqmMin = Number(filterValue(filters, "areaSqmMin")) || undefined;
    const catalogs = await Promise.all(companyIds.map(async (companyId) => {
        const {projects} = await loadMarketingProjectsCatalog(companyId, {search: query, propertyType, bedrooms, areaSqmMin, priceMin, priceMax}, {languageCode});
        return projects.map((project) => ({company: companyId, project}));
    }));
    const found = catalogs.flat();
    const price = (project: MarketingProjectCatalogListItem) => project.minSharePrice ?? 0;
    if (sort === "priceAsc") found.sort((a, b) => price(a.project) - price(b.project));
    if (sort === "priceDesc") found.sort((a, b) => price(b.project) - price(a.project));
    const items = await catalogItems(found.slice(skip, skip + limit), ({project}) => ({
        kind: "project",
        id: project._id,
        title: project.name,
        subtitle: project.location,
        image: project.mainImage,
        city: project.city,
        section: "properties",
        path: `/projects/${project._id}`,
    }));
    return {items, total: found.length};
}

/** The properties section of the portal: companies by their own cities, and their projects. */
export function registerPropertiesPortalProvider(): void {
    registerPortalProvider({
        key: "properties",
        order: 40,
        kinds: ["project"],
        companyIds: propertiesPortalCompanyIds,
        citiesByCompany: companyAddressCities,
        browse: browseProjects,
    });
}
