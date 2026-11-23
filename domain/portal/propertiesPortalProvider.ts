import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalBrowseParams, PortalNewSinceContext} from "@coreModule/domain/portal/portalProvider.types";
import {catalogItems, filterValue, itemPagePath, newSinceClause} from "@coreModule/domain/portal/portalCatalog";
import {companyAddressCities, portalListedCompanyIds, type PortalScope} from "@coreModule/utilities/marketing/portalCompanies";
import {
    MARKETING_BEDROOM_FILTERS,
    MARKETING_PROPERTY_TYPE_IDS,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.shared.types";
import type {MarketingProjectCatalogListItem} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.response.type";
import PropertyManagementConfig from "@propertyManagement/database/schemas/propertyManagementConfig/propertyManagementConfig";
import {loadMarketingProjectsCatalog} from "@propertyManagement/utilities/marketing/marketingProjectsCatalog.util";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import {unitService} from "@propertyManagement/database/schemas/unit/unit.service";

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
 * `keep` narrows them to the projects a "new since" ask is about.
 */
async function browseProjects({companyIds, query, priceMin, priceMax, sort, skip, limit, filters, languageCode}: PortalBrowseParams, keep?: (projectId: string) => boolean) {
    const propertyType = MARKETING_PROPERTY_TYPE_IDS.find((type) => type === filterValue(filters, "propertyType"));
    const bedrooms = MARKETING_BEDROOM_FILTERS.find((option) => option === filterValue(filters, "bedrooms"));
    const areaSqmMin = Number(filterValue(filters, "areaSqmMin")) || undefined;
    const catalogs = await Promise.all(companyIds.map(async (companyId) => {
        const {projects} = await loadMarketingProjectsCatalog(companyId, {search: query, propertyType, bedrooms, areaSqmMin, priceMin, priceMax}, {languageCode});
        return projects.map((project) => ({company: companyId, project}));
    }));
    const found = catalogs.flat().filter(({project}) => !keep || keep(project._id));
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

/**
 * Projects listed after the date (D178): new projects, and projects a unit was added to since. With `ids`, only those
 * projects, as the catalog lists them now.
 */
async function newProjects(context: PortalNewSinceContext) {
    const {companyIds, since, ids} = context;
    const [projects, units] = await Promise.all([
        projectService.find({...newSinceClause(context), company: {$in: companyIds}}, {withDeleted: false}, undefined, "_id"),
        ids ? [] : unitService.find({company: {$in: companyIds}, createdAt: {$gt: since}, project: {$ne: null}}, {withDeleted: false}, undefined, "project"),
    ]);
    const fresh = new Set([...projects.map((project) => project._id.toString()), ...units.map((unit) => String(unit.project))]);
    // Loading the catalog costs a query per project: skip it when nothing is new.
    if (fresh.size === 0) return {items: [], total: 0};
    return browseProjects({...context, sort: "newest", skip: 0}, (projectId) => fresh.has(projectId));
}

/** The properties section of the portal: companies by their own cities, and their projects. */
export function registerPropertiesPortalProvider(): void {
    registerPortalProvider({
        key: "properties",
        order: 40,
        sitePath: "properties",
        // As the portal's section tabs name it (sinfonia `portalSectionName`).
        names: {
            "en-US": {title: "Properties", description: "New developments and homes for sale. Ask the developer directly."},
            "sq-AL": {title: "Pronat", description: "Projekte të reja dhe prona në shitje. Pyesni drejtpërdrejt zhvilluesin."},
            "it-IT": {title: "Immobili", description: "Nuovi progetti e immobili in vendita. Chiedi direttamente al costruttore."},
            "fr-FR": {title: "Biens immobiliers", description: "Programmes neufs et biens à vendre. Contactez directement le promoteur."},
            "de-CH": {title: "Immobilien", description: "Neubauprojekte und Immobilien zum Kauf. Fragen Sie direkt beim Bauträger an."},
        },
        kinds: ["project"],
        companyIds: propertiesPortalCompanyIds,
        citiesByCompany: companyAddressCities,
        browse: (params) => browseProjects(params),
        newSince: newProjects,
        // A project's page (D181): `/projects/{id}`.
        itemAt: async ({scope, companyId, path, languageCode}) => {
            const [page, projectId] = itemPagePath(path).segments;
            if (page !== "projects" || !projectId) return undefined;
            const {items} = await browseProjects({kind: "project", scope, companyIds: [companyId], filters: {}, skip: 0, limit: 1, languageCode}, (id) => id === projectId);
            return items[0] ? {item: items[0], schemaType: "Residence"} : undefined;
        },
    });
}
