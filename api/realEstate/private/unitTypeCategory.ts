import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {createUnitTypeCategoryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitTypeCategory/createUnitTypeCategory.form.validator";
import {editUnitTypeCategoryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitTypeCategory/editUnitTypeCategory.form.validator";
import {UnitTypeCategorySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitTypeCategory/unitTypeCategory.schema-def";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import UnitTypeCategory from "../../../database/schemas/unitTypeCategory/unitTypeCategory";
import {unitTypeCategoryService} from "../../../database/schemas/unitTypeCategory/unitTypeCategory.service";
import {unitTypeService} from "../../../database/schemas/unitType/unitType.service";
import {
    unitTypeCategoriesToDTO,
    unitTypeCategoryToDTO,
} from "../../../utilities/mappers/unitTypeCategory/unitTypeCategoryMapper.dto";
import {unitTypeCategoriesToSelect} from "../../../utilities/mappers/unitTypeCategory/unitTypeCategoryMapper.select";

export const {router} = createCrudRouter({
    collectionName: "unittypecategories",
    model: UnitTypeCategory,
    service: unitTypeCategoryService,
    entityName: "UnitTypeCategory",
    createSchema: createUnitTypeCategoryFormSchema,
    editSchema: editUnitTypeCategoryFormSchema,
    toDTO: unitTypeCategoryToDTO,
    toDTOArray: unitTypeCategoriesToDTO,
    toSelect: unitTypeCategoriesToSelect,
    defaultSort: {name: 1},
    buildCreateData: buildCreateDataFromSchemaDef(UnitTypeCategorySchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(UnitTypeCategorySchemaDef),
    beforeDelete: async ({session, logger, languageCode, company}, doc) => {
        const inUse = await unitTypeService.exists(
            {category: doc._id, company: company._id},
            {session, logger, languageCode},
        );
        if (inUse) {
            throw apiValidationException("unit_type_category_in_use", "", null, languageCode);
        }
    },
});
