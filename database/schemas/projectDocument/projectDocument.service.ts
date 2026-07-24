import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import ProjectDocument, {IProjectDocument} from "./projectDocument";

export class ProjectDocumentService extends BaseCrudService<IProjectDocument, typeof ProjectDocument> {
    constructor() {
        super(ProjectDocument, "ProjectDocument");
    }
}

export const projectDocumentService = new ProjectDocumentService();
