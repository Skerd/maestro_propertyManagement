import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {WorkPackageSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/workPackage/workPackage.schema-def";
import {createWorkPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/workPackage/createWorkPackage.form.validator";
import {editWorkPackageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/workPackage/editWorkPackage.form.validator";
import WorkPackage from "../../../database/schemas/workPackage/workPackage";
import {workPackageService} from "../../../database/schemas/workPackage/workPackage.service";
import {WorkPackageActions} from "../../../database/schemas/workPackage/workPackage.actions";
import {workPackageToDTO, workPackagesToDTO} from "../../../utilities/mappers/workPackage/workPackageMapper.dto";
import {workPackagesToSelect} from "../../../utilities/mappers/workPackage/workPackageMapper.select";


const transforms: Record<string, (v: unknown) => unknown> = {
    issuedAt: (v) => new Date(v as string),
    plannedStart: (v) => new Date(v as string),
    plannedEnd: (v) => new Date(v as string),
    startDate: (v) => new Date(v as string),
    endDate: (v) => new Date(v as string),
    claimPeriodStart: (v) => new Date(v as string),
    claimPeriodEnd: (v) => new Date(v as string),
    dueDate: (v) => new Date(v as string),
    diaryDate: (v) => new Date(v as string),
    incidentDate: (v) => new Date(v as string),
    retentionReleaseDate: (v) => new Date(v as string),
    testDate: (v) => new Date(v as string),
    decidedAt: (v) => new Date(v as string),
    expiresAt: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "workpackages",
    model: WorkPackage,
    service: workPackageService,
    entityName: "WorkPackage",
    createSchema: createWorkPackageFormSchema,
    editSchema: editWorkPackageFormSchema,
    toDTO: workPackageToDTO,
    toDTOArray: workPackagesToDTO,
    toSelect: workPackagesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    
    actions: WorkPackageActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(WorkPackageSchemaDef, transforms)(params);
        data.status = "planned";
        
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(WorkPackageSchemaDef, transforms)({...params, media}, writeFields);
        
        return data;
    },
});
