import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {SpecificationSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/specification.schema-def";
import {createSpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/createSpecification.form.validator";
import {editSpecificationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/editSpecification.form.validator";
import Specification from "../../../database/schemas/specification/specification";
import {specificationService} from "../../../database/schemas/specification/specification.service";
import {SpecificationActions} from "../../../database/schemas/specification/specification.actions";
import {specificationToDTO, specificationsToDTO} from "../../../utilities/mappers/specification/specificationMapper.dto";
import {specificationsToSelect} from "../../../utilities/mappers/specification/specificationMapper.select";

export const {router} = createCrudRouter({
    collectionName: "specifications",
    model: Specification,
    service: specificationService,
    entityName: "Specification",
    createSchema: createSpecificationFormSchema,
    editSchema: editSpecificationFormSchema,
    toDTO: specificationToDTO,
    toDTOArray: specificationsToDTO,
    toSelect: specificationsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "title",

    actions: SpecificationActions,
    extraListFilter: async ({projectId, edificeId, workPackageId, status}: any) => {
        const filter: Record<string, any> = {};
        if (projectId && projectId !== "") filter.project = new ObjectId(String(projectId));
        if (edificeId && edificeId !== "") filter.edifice = new ObjectId(String(edificeId));
        if (workPackageId && workPackageId !== "") filter.workPackage = new ObjectId(String(workPackageId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(SpecificationSchemaDef)(params);
        data.status = "draft";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(SpecificationSchemaDef)({...params, media}, writeFields);
        return data;
    },
});
