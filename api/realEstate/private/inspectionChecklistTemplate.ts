import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {InspectionChecklistTemplateSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/inspectionChecklistTemplate.schema-def";
import {createInspectionChecklistTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/createInspectionChecklistTemplate.form.validator";
import {editInspectionChecklistTemplateFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/editInspectionChecklistTemplate.form.validator";
import InspectionChecklistTemplate from "../../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate";
import {inspectionChecklistTemplateService} from "../../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate.service";
import {InspectionChecklistTemplateActions} from "../../../database/schemas/inspectionChecklistTemplate/inspectionChecklistTemplate.actions";
import {inspectionChecklistTemplateToDTO, inspectionChecklistTemplatesToDTO} from "../../../utilities/mappers/inspectionChecklistTemplate/inspectionChecklistTemplateMapper.dto";
import {inspectionChecklistTemplatesToSelect} from "../../../utilities/mappers/inspectionChecklistTemplate/inspectionChecklistTemplateMapper.select";


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
    collectionName: "inspectionchecklisttemplates",
    model: InspectionChecklistTemplate,
    service: inspectionChecklistTemplateService,
    entityName: "InspectionChecklistTemplate",
    createSchema: createInspectionChecklistTemplateFormSchema,
    editSchema: editInspectionChecklistTemplateFormSchema,
    toDTO: inspectionChecklistTemplateToDTO,
    toDTOArray: inspectionChecklistTemplatesToDTO,
    toSelect: inspectionChecklistTemplatesToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",
    
    actions: InspectionChecklistTemplateActions,
    extraListFilter: async ({projectId, edificeId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(InspectionChecklistTemplateSchemaDef, transforms)(params);
        data.status = "active";
        
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(InspectionChecklistTemplateSchemaDef, transforms)({...params, media}, writeFields);
        
        return data;
    },
});
