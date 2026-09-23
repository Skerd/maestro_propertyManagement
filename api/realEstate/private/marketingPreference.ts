import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {MarketingPreferenceSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/marketingPreference.schema-def";
import {validateTableForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import MarketingPreference from "../../../database/schemas/marketingPreference/marketingPreference";
import {marketingPreferenceService} from "../../../database/schemas/marketingPreference/marketingPreference.service";
import {
    marketingPreferenceToDTO,
    marketingPreferencesToDTO,
    marketingPreferencesToSelect,
} from "../../../utilities/mappers/marketingPreference/marketingPreferenceMapper.dto";
import {MarketingPreferenceActions} from "../../../database/schemas/marketingPreference/marketingPreference.actions";
import {createMarketingPreferenceFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/createMarketingPreference.form.validator";
import {editMarketingPreferenceRowFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/editMarketingPreferenceRow.form.validator";

/**
 * Staff-facing CRUD over consent rows, plus the `/me` actions the account page
 * uses. The people these rows describe write them through `/me` or the
 * unsubscribe link; staff mostly read them to answer "why didn't this person
 * get the campaign".
 */
export const {router} = createCrudRouter({
    collectionName: "marketingpreferences",
    model:          MarketingPreference,
    service:        marketingPreferenceService,
    entityName:     "MarketingPreference",
    actions:        MarketingPreferenceActions,
    listSchema:     validateTableForm,
    createSchema:   createMarketingPreferenceFormSchema,
    editSchema:     editMarketingPreferenceRowFormSchema,
    toDTO:          marketingPreferenceToDTO,
    toDTOArray:     marketingPreferencesToDTO,
    toSelect:       marketingPreferencesToSelect,
    defaultSort:    {email: 1},
    selectSort:     {email: 1},
    selectSearchField: "email",
    buildCreateData: buildCreateDataFromSchemaDef(MarketingPreferenceSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(MarketingPreferenceSchemaDef),
});
