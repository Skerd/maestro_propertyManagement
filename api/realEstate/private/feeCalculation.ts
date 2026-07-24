import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {FeeCalculationSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/feeCalculation.schema-def";
import {createFeeCalculationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/createFeeCalculation.form.validator";
import {editFeeCalculationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/feeCalculation/editFeeCalculation.form.validator";
import FeeCalculation from "../../../database/schemas/feeCalculation/feeCalculation";
import {feeCalculationService} from "../../../database/schemas/feeCalculation/feeCalculation.service";
import {FeeCalculationActions} from "../../../database/schemas/feeCalculation/feeCalculation.actions";
import {feeCalculationToDTO, feeCalculationsToDTO} from "../../../utilities/mappers/feeCalculation/feeCalculationMapper.dto";
import {feeCalculationsToSelect} from "../../../utilities/mappers/feeCalculation/feeCalculationMapper.select";

export const {router} = createCrudRouter({
    collectionName: "feecalculations",
    model: FeeCalculation,
    service: feeCalculationService,
    entityName: "FeeCalculation",
    createSchema: createFeeCalculationFormSchema,
    editSchema: editFeeCalculationFormSchema,
    toDTO: feeCalculationToDTO,
    toDTOArray: feeCalculationsToDTO,
    toSelect: feeCalculationsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "name",
    actions: FeeCalculationActions,
    extraListFilter: async ({consultantAppointmentId, status}: any) => {
        const filter: Record<string, any> = {};
        if (consultantAppointmentId && consultantAppointmentId !== "") filter.consultantAppointment = new ObjectId(String(consultantAppointmentId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(FeeCalculationSchemaDef)(params);
        data.status = "planned";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => buildUpdateDataFromSchemaDef(FeeCalculationSchemaDef)({...params, media}, writeFields),
});
