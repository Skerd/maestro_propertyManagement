import type {ReportableDefinition} from "@coreModule/domain/reports/reportables";
import {portalCompanyRefs} from "@coreModule/utilities/marketing/portalCompanies";
import {projectService} from "@propertyManagement/database/schemas/project/project.service";
import Project from "@propertyManagement/database/schemas/project/project";

/**
 * What people can report to the platform about property listings (D191): a project the portal and the company's website
 * list. Hiding it takes the project and its units off every public page, list, search and count.
 */
export const propertyManagementReportables: ReportableDefinition[] = [
    {
        kind: "propertyManagement.project",
        typeLabel: {
            "en-US": "Property project",
            "de-CH": "Immobilienprojekt",
            "fr-FR": "Projet immobilier",
            "it-IT": "Progetto immobiliare",
            "sq-AL": "Projekt pronash",
        },
        snapshot: async ({recordId, session}) => {
            const project = await projectService.findReportable(recordId, session);
            if (!project) return null;
            // The project's page on the portal, inside its company's site (`sitePath` of the properties portal provider).
            const company = (await portalCompanyRefs([project.company])).get(project.company.toString());
            return {
                title: project.name,
                companyId: project.company,
                url: company ? `/properties/${company.slug}/projects/${project._id.toString()}` : undefined,
                hidden: project.hiddenByPlatform === true,
            };
        },
        model: Project,
    },
];
