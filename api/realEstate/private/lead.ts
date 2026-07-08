import {Decimal128, ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {LeadSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/lead.schema-def";
import {createLeadFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/createLead.form.validator";
import {editLeadFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/lead/editLead.form.validator";
import Lead, {LeadStatus} from "../../../database/schemas/lead/lead";
import {LeadActions} from "../../../database/schemas/lead/lead.actions";
import {leadService} from "../../../database/schemas/lead/lead.service";
import {leadToDTO, leadsToDTO} from "../../../utilities/mappers/lead/leadMapper.dto";
import {leadsToSelect} from "../../../utilities/mappers/lead/leadMapper.select";

const dateTransform  = (v: unknown) => new Date(v as string);
const budgetTransform = (v: unknown) => Decimal128.fromString(String(v));

export const {router} = createCrudRouter({
    collectionName: "leads",
    model:          Lead,
    service:        leadService,
    createSchema:   createLeadFormSchema,
    editSchema:     editLeadFormSchema,
    toDTO:          leadToDTO,
    toDTOArray:     leadsToDTO,
    toSelect:       leadsToSelect,
    defaultSort:    {createdAt: -1},
    selectSort:     {firstName: 1},
    buildCreateData: buildCreateDataFromSchemaDef(LeadSchemaDef, {
        budget:      budgetTransform,
        followUpDate: dateTransform,
    }),
    buildUpdateData: buildUpdateDataFromSchemaDef(LeadSchemaDef, {
        budget:      budgetTransform,
        followUpDate: dateTransform,
    }),
    afterUpdate: async ({session, logger, languageCode, company, actionUserCtx, _id, status}, existingBeforeUpdate) => {
        if (status === LeadStatus.WON && existingBeforeUpdate.status !== LeadStatus.WON) {
            await leadService.updateByIdOrThrow(
                new ObjectId(_id),
                {$set: {convertedAt: new Date()}},
                {session, logger, languageCode, actionUserCtx},
            );
        }
    },
    actions: LeadActions,
});
