import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {DesignStageSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/designStage.schema-def";
import {createDesignStageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/createDesignStage.form.validator";
import {editDesignStageFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/designStage/editDesignStage.form.validator";
import DesignStage from "../../../database/schemas/designStage/designStage";
import {designStageService} from "../../../database/schemas/designStage/designStage.service";
import {DesignStageActions} from "../../../database/schemas/designStage/designStage.actions";
import {designStageToDTO, designStagesToDTO} from "../../../utilities/mappers/designStage/designStageMapper.dto";
import {designStagesToSelect} from "../../../utilities/mappers/designStage/designStageMapper.select";


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
    collectionName: "designstages",
    model: DesignStage,
    service: designStageService,
    entityName: "DesignStage",
    createSchema: createDesignStageFormSchema,
    editSchema: editDesignStageFormSchema,
    toDTO: designStageToDTO,
    toDTOArray: designStagesToDTO,
    toSelect: designStagesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    
    actions: DesignStageActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(DesignStageSchemaDef, transforms)(params);
        data.status = "not_started";
        
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(DesignStageSchemaDef, transforms)({...params, media}, writeFields);
        
        return data;
    },
});
