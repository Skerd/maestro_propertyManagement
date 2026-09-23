import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {AdCampaignRecipientSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignRecipient/adCampaignRecipient.schema-def";
import {createAdCampaignRecipientFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignRecipient/createAdCampaignRecipient.form.validator";
import {editAdCampaignRecipientFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaignRecipient/editAdCampaignRecipient.form.validator";
import {validateTableForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import AdCampaignRecipient from "../../../database/schemas/adCampaignRecipient/adCampaignRecipient";
import {adCampaignRecipientService} from "../../../database/schemas/adCampaignRecipient/adCampaignRecipient.service";
import {
    adCampaignRecipientToDTO,
    adCampaignRecipientsToDTO,
    adCampaignRecipientsToSelect,
} from "../../../utilities/mappers/adCampaignRecipient/adCampaignRecipientMapper.dto";

/**
 * Effectively read-only.
 *
 * The factory requires create and edit schemas, so they are supplied, but every
 * field on the recipient schema is `SYSTEM_WRITE`: the permission layer strips
 * the payload before either builder runs, leaving nothing to write. Rows are
 * written by the materializer and the sender through the model directly, which
 * is what keeps this collection trustworthy as a consent audit trail.
 */
export const {router} = createCrudRouter({
    collectionName: "adcampaignrecipients",
    model:          AdCampaignRecipient,
    service:        adCampaignRecipientService,
    entityName:     "AdCampaignRecipient",
    listSchema:     validateTableForm,
    createSchema:   createAdCampaignRecipientFormSchema,
    editSchema:     editAdCampaignRecipientFormSchema,
    toDTO:          adCampaignRecipientToDTO,
    toDTOArray:     adCampaignRecipientsToDTO,
    toSelect:       adCampaignRecipientsToSelect,
    defaultSort:    {createdAt: -1},
    selectSort:     {email: 1},
    selectSearchField: "email",
    buildCreateData: buildCreateDataFromSchemaDef(AdCampaignRecipientSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(AdCampaignRecipientSchemaDef),
});
