import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {PropertyManagementConfigSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/propertyManagementConfig.schema-def";
import {createPropertyManagementConfigFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/createPropertyManagementConfig.form.validator";
import {editPropertyManagementConfigFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/propertyManagementConfig/editPropertyManagementConfig.form.validator";
import PropertyManagementConfig from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig";
import {PropertyManagementConfigActions} from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig.actions";
import {propertyManagementConfigService} from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig.service";
import {
    propertyManagementConfigToDTO,
    propertyManagementConfigsToDTO,
} from "../../../utilities/mappers/propertyManagementConfig/propertyManagementConfigMapper.dto";
import {propertyManagementConfigsToSelect} from "../../../utilities/mappers/propertyManagementConfig/propertyManagementConfigMapper.select";

export const {router} = createCrudRouter({
    collectionName: "propertymanagementconfigs",
    model: PropertyManagementConfig,
    service: propertyManagementConfigService,
    entityName: "PropertyManagementConfig",
    createSchema: createPropertyManagementConfigFormSchema,
    editSchema: editPropertyManagementConfigFormSchema,
    toDTO: propertyManagementConfigToDTO,
    toDTOArray: propertyManagementConfigsToDTO,
    toSelect: propertyManagementConfigsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "_id",
    actions: PropertyManagementConfigActions,
    buildCreateData: async (params: any) => {
        const data = buildCreateDataFromSchemaDef(PropertyManagementConfigSchemaDef)(params);
        if (data.requiresSaleApproval === undefined || data.requiresSaleApproval === null) {
            data.requiresSaleApproval = false;
        }
        if (data.requiresHandoverPackageForHandover === undefined || data.requiresHandoverPackageForHandover === null) {
            data.requiresHandoverPackageForHandover = false;
        }
        return data;
    },
    buildUpdateData: async (params: any, writeFields) => {
        return buildUpdateDataFromSchemaDef(PropertyManagementConfigSchemaDef)(params, writeFields);
    },
});
