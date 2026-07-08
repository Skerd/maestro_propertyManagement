import {ObjectId} from 'mongodb';
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {ConstructorSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.schema-def";
import {mediaUploadMW} from '@coreModule/utilities/middlewares/mediaUploadMW';
import {constructorService} from '../../../database/schemas/constructor/constructor.service';
import {edificeService} from '../../../database/schemas/edifice/edifice.service';
import {createConstructorFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/createConstructor.form.validator";
import {editConstructorFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/editConstructor.form.validator";
import Constructor from "../../../database/schemas/constructor/constructor";
import {constructorToDTO, constructorsToDTO} from "../../../utilities/mappers/constructor/constructorMapper.dto";
import {constructorsToSelect} from "../../../utilities/mappers/constructor/constructorMapper.select";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {countryService} from "@coreModule/database/schemas/country/country.service";
import {stateService} from "@coreModule/database/schemas/state/state.service";
import {cityService} from "@coreModule/database/schemas/city/city.service";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";

const uploadMW = mediaUploadMW({maxFiles: 1, maxFileSize: 10 * 1024 * 1024});

async function validateAndMapAddresses(
    addresses: any[],
    companyId: ObjectId,
    ctx: {logger: any; languageCode: string; session: any},
): Promise<any[]> {
    return Promise.all(
        addresses.map(async (addr) => {
            const countryId = new ObjectId(addr.country);
            const stateId   = addr.state ? new ObjectId(addr.state) : undefined;
            const cityId    = new ObjectId(addr.city);

            const cityFilter: Record<string, any> = {_id: cityId, company: companyId, country: countryId};
            if (stateId) cityFilter.state = stateId;

            const [country, state, city] = await Promise.all([
                countryService.findOne({_id: countryId, company: companyId}, ctx),
                stateId
                    ? stateService.findOne({_id: stateId, company: companyId, country: countryId}, ctx)
                    : Promise.resolve(true as any),
                cityService.findOne(cityFilter, ctx),
            ]);

            if (!country) throw apiValidationException("country_not_found", null, null, ctx.languageCode);
            if (stateId && !state) throw apiValidationException("state_not_found", null, null, ctx.languageCode);
            if (!city) throw apiValidationException("city_not_found", null, null, ctx.languageCode);

            return {
                street:     addr.street,
                postalCode: addr.postalCode,
                city:       cityId,
                state:      stateId,
                country:    countryId,
                latitude:   addr.latitude,
                longitude:  addr.longitude
            };
        }),
    );
}

export const {router} = createCrudRouter({
    collectionName: "constructors",
    model: Constructor,
    service: constructorService,
    createSchema: createConstructorFormSchema,
    editSchema: editConstructorFormSchema,
    toDTO: (doc) => constructorToDTO(doc),
    toDTOArray: (docs) => constructorsToDTO(docs),
    toSelect: constructorsToSelect,
    defaultSort: {name: 1},
    createMiddleware: [uploadMW],
    editMiddleware: [uploadMW],
    buildCreateData: async ({ fileIds, company, logger, languageCode, session, ...params }: any) => {
        const validatedAddresses = params.addresses?.length > 0 ? await validateAndMapAddresses(params.addresses, new ObjectId(company._id), { logger, languageCode, session }) : [];
        const data = buildCreateDataFromSchemaDef(ConstructorSchemaDef, {
            email:     (v) => String(v).toLowerCase(),
            addresses: (v) => v,
        })({ ...params, addresses: validatedAddresses });
        if (fileIds?.length > 0) data.logo = new ObjectId(fileIds[0]);
        return data;
    },
    buildUpdateData: async ({ fileIds, company, logger, languageCode, session, ...params }: any, writeFields) => {
        let resolvedAddresses = params.addresses;
        if (params.addresses !== undefined && writeFields.addresses) {
            resolvedAddresses = params.addresses?.length > 0 ? await validateAndMapAddresses(params.addresses, new ObjectId(company._id), { logger, languageCode, session }) : [];
        }
        const data = buildUpdateDataFromSchemaDef(ConstructorSchemaDef, {
            email:     (v) => String(v).toLowerCase(),
            addresses: (v) => v,
        })({ ...params, addresses: resolvedAddresses }, writeFields);

        if (fileIds?.length > 0 && writeFields.logo) data.logo = new ObjectId(fileIds[0]);

        return data;
    },
    afterDelete: async ({session, logger, languageCode, company, actionUserCtx}, doc) => {
        const constructorId = doc._id;
        const edifices = await edificeService.find(
            {company: company._id, constructors: constructorId},
            {session, logger, languageCode},
        );
        for (const edifice of edifices) {
            if (Array.isArray(edifice.constructors)) {
                edifice.constructors = edifice.constructors.filter(
                    (cId: any) => cId.toString() !== constructorId.toString(),
                );
                edifice.$locals = edifice.$locals || {};
                edifice.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
                await edifice.save({session});
            }
        }
    },
});
