import {IProject} from "../../../database/schemas/project/project";
import {
    Project,
    ProjectEdificeCoordinate,
    ProjectStatistics
} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/project.dto";
import {decimalToNumber, mapMedia} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function projectToDTO(project: IProject, statistics?: ProjectStatistics, edificesCoordinates?: ProjectEdificeCoordinate[]): Project {
    return {
        _id: project._id.toString(),
        name: project.name,
        description: project.description,
        saleCommissionRatePercent: decimalToNumber(project.saleCommissionRatePercent),
        reservationCommissionRatePercent: decimalToNumber(project.reservationCommissionRatePercent),
        mainImage: project.mainImage ? mapMedia(project.mainImage) : undefined,
        imageGallery: !!project.imageGallery ? project.imageGallery?.map(mapMedia) : undefined,
        videoGallery: !!project.videoGallery ? project.videoGallery?.map(mapMedia) : undefined,
        mediaFiles: !!project.mediaFiles ? project.mediaFiles?.map(mapMedia) : undefined,
        marketingBooklet: project.marketingBooklet ? mapMedia(project.marketingBooklet) : undefined,
        magazineFile: project.magazineFile ? mapMedia(project.magazineFile) : undefined,
        magazineTitle: project.magazineTitle?.trim() || undefined,
        magazineDescription: project.magazineDescription?.trim() || undefined,
        socialLinks: Array.isArray(project.socialLinks)
            ? project.socialLinks
                  .filter((item) => item?.name?.trim() && item?.link?.trim())
                  .map((item) => ({
                      name: item.name.trim(),
                      link: item.link.trim(),
                      logo:
                          item.logo &&
                          typeof item.logo === "object" &&
                          (item.logo as {_id?: unknown})._id != null
                              ? mapMedia(item.logo)
                              : undefined,
                  }))
            : undefined,
        featuredOnHomepage: project.featuredOnHomepage,
        featuredSortOrder: project.featuredSortOrder,
        statistics,
        edificesCoordinates: edificesCoordinates && edificesCoordinates.length > 0 ? edificesCoordinates : undefined,
        ...mapSoftDeleteToDTO(project),
        ...mapOwnershipToDTO(project),
        ...mapLifeCycleToDTO(project)
    };
}

export function projectsToDTO(projects: IProject[], statistics?: Record<string, ProjectStatistics>, edificesCoordinatesByProjectId?: Record<string, ProjectEdificeCoordinate[]>): Project[] {
    let allProjects: Project[] = [];
    for (let project of projects) {
        const id = project._id.toString();
        allProjects.push(projectToDTO(project, statistics ? statistics[id] : undefined, edificesCoordinatesByProjectId?.[id]));
    }
    return allProjects;
}

