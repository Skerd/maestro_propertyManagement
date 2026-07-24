import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {TenderInvitationSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/tenderInvitation.schema-def";
import {createTenderInvitationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/createTenderInvitation.form.validator";
import {editTenderInvitationFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/tenderInvitation/editTenderInvitation.form.validator";
import TenderInvitation from "../../../database/schemas/tenderInvitation/tenderInvitation";
import {tenderInvitationService} from "../../../database/schemas/tenderInvitation/tenderInvitation.service";
import {TenderInvitationActions} from "../../../database/schemas/tenderInvitation/tenderInvitation.actions";
import {tenderInvitationToDTO, tenderInvitationsToDTO} from "../../../utilities/mappers/tenderInvitation/tenderInvitationMapper.dto";
import {tenderInvitationsToSelect} from "../../../utilities/mappers/tenderInvitation/tenderInvitationMapper.select";

const transforms: Record<string, (v: unknown) => unknown> = {
    invitedAt: (v) => new Date(v as string),
    respondedAt: (v) => new Date(v as string),
};

export const {router} = createCrudRouter({
    collectionName: "tenderinvitations",
    model: TenderInvitation,
    service: tenderInvitationService,
    entityName: "TenderInvitation",
    createSchema: createTenderInvitationFormSchema,
    editSchema: editTenderInvitationFormSchema,
    toDTO: tenderInvitationToDTO,
    toDTOArray: tenderInvitationsToDTO,
    toSelect: tenderInvitationsToSelect,
    defaultSort: {createdAt: -1},
    selectSearchField: "name",

    actions: TenderInvitationActions,
    extraListFilter: async ({tenderId, status}: any) => {
        const filter: Record<string, any> = {};
        if (tenderId && tenderId !== "") filter.tender = new ObjectId(String(tenderId));
        if (status && status !== "") filter.status = status;
        return filter;
    },
    buildCreateData: async ({fileIds, ...params}: any) => {
        const data = buildCreateDataFromSchemaDef(TenderInvitationSchemaDef, transforms)(params);
        data.status = "invited";
        return data;
    },
    buildUpdateData: async ({fileIds, media, ...params}: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(TenderInvitationSchemaDef, transforms)({...params, media}, writeFields);
        return data;
    },
});
