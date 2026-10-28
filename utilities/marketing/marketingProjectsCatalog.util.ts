import type {ObjectId} from "mongodb";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {objectIdToString} from "@coreModule/utilities/mappers/common.mapper";
import type {
    MarketingProjectCatalogListItem,
    MarketingProjectsCatalogFilterOptions,
} from "armonia/src/modules/propertyManagement/api/realEstate/public/marketingProjectsCatalog/marketingProjectsCatalog.form.response.type";
import {projectService} from "../../database/schemas/project/project.service";
import {loadMarketingCatalogHierarchy} from "./marketingCatalogHierarchy.util";
import {applyCatalogProjectFilters, buildCatalogFilterOptions, type CatalogProjectFilterParams} from "./marketingCatalogFilters.util";
import {mapMarketingProjectCatalogListItem} from "../mappers/marketing/marketingCatalog.mapper";

/**
 * A company's projects as the public catalog lists them, narrowed by the catalog filters,
 * with the filter options of all of them. Shared by the marketing site and the portal.
 */
export async function loadMarketingProjectsCatalog(
    companyId: ObjectId,
    filters: CatalogProjectFilterParams,
    opts: {languageCode: string; logger?: serverLogger},
): Promise<{projects: MarketingProjectCatalogListItem[]; filterOptions: MarketingProjectsCatalogFilterOptions}> {
    const projects = await projectService.find(
        {company: companyId},
        {withDeleted: false, ...opts},
        ["mainImage", "imageGallery", {path: "socialLinks.logo"}],
    );

    const hierarchy = await loadMarketingCatalogHierarchy(projects.map((project) => project._id), companyId);
    const mapped = projects.map((project) => {
        const projectKey = objectIdToString(project._id);
        const edifices = hierarchy.edificesByProject.get(projectKey) ?? [];
        const units = hierarchy.unitsByProject.get(projectKey) ?? [];
        return mapMarketingProjectCatalogListItem(project, edifices, units, hierarchy.floorsByEdifice);
    });

    return {
        projects: applyCatalogProjectFilters(mapped, hierarchy.unitsByProject, filters),
        filterOptions: buildCatalogFilterOptions(mapped),
    };
}
