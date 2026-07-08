import {IProject} from "../../../database/schemas/project/project";
import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";

export function projectToSelect(project: IProject): ApiSelectDatum {
    return {
        value: project._id.toString(),
        label: project.name
    }
}

export function projectsToSelect(projects: IProject[]): ApiSelectDatum[] {
    return projects.map(projectToSelect);
}