import {unitTypeService} from '../../../database/schemas/unitType/unitType.service';
import {edificeService} from '../../../database/schemas/edifice/edifice.service';
import {unitService} from '../../../database/schemas/unit/unit.service';
import {createUnitTypeFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitType/createUnitType.form.validator";
import {editUnitTypeFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitType/editUnitType.form.validator";
import UnitType from "../../../database/schemas/unitType/unitType";
import {unitTypesToDTO, unitTypeToDTO} from "../../../utilities/mappers/unitType/unitTypeMapper.dto";
import {unitTypesToSelect} from "../../../utilities/mappers/unitType/unitTypeMapper.select";
import {apiValidationException} from 'armonia/src/modules/core/helpers/exceptions';
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {UnitTypeSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitType/unitType.schema-def";

export const {router} = createCrudRouter({
    collectionName: "unittypes",
    model: UnitType,
    service: unitTypeService,
    entityName: "UnitType",
    createSchema: createUnitTypeFormSchema,
    editSchema: editUnitTypeFormSchema,
    toDTO: (doc) => unitTypeToDTO(doc),
    toDTOArray: (docs) => unitTypesToDTO(docs),
    toSelect: (docs) => unitTypesToSelect(docs),
    defaultSort: {name: 1},
    buildCreateData: ({name, company, ...params}) => {
        // slug is server-owned (not in SchemaDef / no client write) — must be set explicitly
        return {
            ...buildCreateDataFromSchemaDef(UnitTypeSchemaDef)({name, company, ...params}),
            slug: `${company.name.toLowerCase().replace(/\s+/g, "")}_${name.toLowerCase().replace(/\s+/g, "")}`,
        };
    },
    buildUpdateData: buildUpdateDataFromSchemaDef(UnitTypeSchemaDef, {}),
    beforeDelete: async ({session, logger, languageCode, company}, doc) => {
        const [usedByUnits, usedByEdifices] = await Promise.all([
            unitService.exists({unitType: doc._id, company: company._id}, {session, logger}),
            edificeService.exists({propertyTypes: doc._id, company: company._id}, {session, logger}),
        ]);
        if (usedByUnits || usedByEdifices) {
            throw apiValidationException("unit_type_in_use", "", null, languageCode);
        }
    },
});
