import {Decimal128, ObjectId} from 'mongodb';
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {EdificeSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.schema-def";
import {mediaUploadMW} from '@coreModule/utilities/middlewares/mediaUploadMW';
import {createCrudRouter} from '@coreModule/api/crudRouterFactory';
import {createEdificeFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/createEdifice.form.validator";
import {editEdificeFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/editEdifice.form.validator";
import Edifice from "../../../database/schemas/edifice/edifice";
import {edificesToDTO, edificeToDTO} from "../../../utilities/mappers/edifice/edificeMapper.dto";
import {edificesToSelect} from "../../../utilities/mappers/edifice/edificeMapper.select";
import {CreateEdificeFormType} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.schema-def";
import {constructorService} from "../../../database/schemas/constructor/constructor.service";
import {edificeService} from "../../../database/schemas/edifice/edifice.service";
import {unitTypeService} from "../../../database/schemas/unitType/unitType.service";
import {projectService} from "../../../database/schemas/project/project.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {cityService} from "@coreModule/database/schemas/city/city.service";
import {stateService} from "@coreModule/database/schemas/state/state.service";
import {countryService} from "@coreModule/database/schemas/country/country.service";
import {EdificeActions} from "../../../database/schemas/edifice/edifice.actions";
import {IConstructor} from "@propertyManagement/database/schemas/constructor/constructor";
import {IUnitType} from "@propertyManagement/database/schemas/unitType/unitType";

const mediaUpload = mediaUploadMW({
    fields: { mainImage: 1, imageGallery: 10, videoGallery: 3, mediaFiles: 20, marketingBooklet: 1 },
    maxFileSize: 250 * 1024 * 1024,
});

export const { router } = createCrudRouter({
    collectionName: "edifices",
    model:          Edifice,
    service:        edificeService,
    entityName:     "Edifice",
    createSchema:   createEdificeFormSchema,
    editSchema:     editEdificeFormSchema,
    toDTO:          edificeToDTO,
    toDTOArray:     edificesToDTO,
    toSelect:       edificesToSelect,
    createMiddleware: [mediaUpload],
    editMiddleware:   [mediaUpload],
    enrichList: async (edifices, { actionUserCtx, languageCode, logger }) => {
        const ids = edifices.map((e: any) => e._id);
        const [statisticsByEdificeId, floorsCoordinatesByEdificeId] = await Promise.all([
            edificeService.calculateStatistics(ids, actionUserCtx, languageCode, logger),
            edificeService.getFloorsCoordinatesByEdificeIds(ids, { logger, languageCode, actionUserCtx }),
        ]);
        return edificesToDTO(edifices, { statisticsByEdificeId, floorsCoordinatesByEdificeId });
    },
    enrichSingle: async (edifice, { actionUserCtx, languageCode, logger }) => {
        const [statisticsByEdificeId, floorsCoordinatesByEdificeId] = await Promise.all([
            edificeService.calculateStatistics([edifice._id], actionUserCtx, languageCode, logger),
            edificeService.getFloorsCoordinatesByEdificeIds([edifice._id], { logger, languageCode, actionUserCtx }),
        ]);
        return edificeToDTO(edifice, { statistics: statisticsByEdificeId[edifice._id], floorsCoordinates: floorsCoordinatesByEdificeId[edifice._id] });
    },
    buildCreateData: async ({ session, logger, languageCode, company, polygonCoordinates, energyClass, ...params }: CreateEdificeFormType & Record<string, any>) => {
        const { project, investmentCurrency, address, constructors, propertyTypes } = params;

        const [foundProject, foundCurrency, foundCountry, foundCity, foundConstructors, foundPropertyTypes] = await Promise.all([
            projectService.findOneOrThrow({ _id: new ObjectId(project), company: company._id }, { session, logger, languageCode, withDeleted: false }),
            currencyService.findOneOrThrow({ company: company._id, _id: new ObjectId(investmentCurrency) }, { session, logger, languageCode, withDeleted: false }),
            countryService.findOneOrThrow({ company: company._id, _id: new ObjectId(address.country) }, { session, logger, languageCode, withDeleted: false }),
            cityService.findOneOrThrow({ company: company._id, _id: new ObjectId(address.city), country: new ObjectId(address.country) }, { session, logger, languageCode, withDeleted: false }),
            constructorService.find({ company: company._id, _id: { $in: constructors ?? [] } }, { session, logger, languageCode, withDeleted: false }),
            unitTypeService.find({ company: company._id, _id: { $in: propertyTypes ?? [] } }, { session, logger, languageCode, withDeleted: false }),
        ]);

        const foundState = address.state ? await stateService.findOne({ company: company._id, _id: new ObjectId(address.state), country: new ObjectId(address.country) }, {session, logger, languageCode, withDeleted: false}) : undefined;

        const resolvedParams = {
            ...params,
            project:            foundProject._id,
            investmentCurrency: foundCurrency._id,
            constructors:       foundConstructors.map((constructor) => constructor._id),
            propertyTypes:      foundPropertyTypes.map((propertyType) => propertyType._id),
            address:            { ...address, country: foundCountry._id, state: foundState._id, city: foundCity._id },
        };

        const data = buildCreateDataFromSchemaDef(EdificeSchemaDef, {
            investmentValue:    (v) => Decimal128.fromString(String(v)),
        })(resolvedParams);

        if (polygonCoordinates !== undefined) {
            data.polygonCoordinates = polygonCoordinates.length > 0 ? polygonCoordinates : [];
        }
        if (energyClass !== undefined) {
            data.energyClass = energyClass || undefined;
        }

        return data;
    },
    buildUpdateData: async ({ session, logger, languageCode, company, polygonCoordinates, energyClass, ...params }: any, writeFields) => {
        const { project, investmentCurrency, address, constructors, propertyTypes } = params;

        const [foundProject, foundCurrency, foundConstructors, foundPropertyTypes] = await Promise.all([
            project != null && writeFields.project ? projectService.findOneOrThrow({ _id: new ObjectId(project), company: company._id }, { session, logger, languageCode, withDeleted: false }) : Promise.resolve(undefined),
            investmentCurrency != null && writeFields.investmentCurrency ? currencyService.findOneOrThrow({ company: company._id, _id: new ObjectId(investmentCurrency) }, { session, logger, languageCode, withDeleted: false }) : Promise.resolve(undefined),
            constructors != null && writeFields.constructors ? constructorService.find({ company: company._id, _id: { $in: constructors } }, { session, logger, languageCode, withDeleted: false }) : Promise.resolve(undefined),
            propertyTypes != null && writeFields.propertyTypes ? unitTypeService.find({ company: company._id, _id: { $in: propertyTypes } }, { session, logger, languageCode, withDeleted: false }) : Promise.resolve(undefined),
        ]);

        let resolvedAddress = address;
        if (address != null && writeFields.address) {
            const addressKeys = writeFields.address.keys ?? {};
            const countryFilter = address.country != null && addressKeys.country ? { country: new ObjectId(address.country) } : {};
            const [foundCountry, foundState, foundCity] = await Promise.all([
                address.country != null && addressKeys.country ? countryService.findOneOrThrow({ company: company._id, _id: new ObjectId(address.country) }, { session, logger, languageCode, withDeleted: false }) : Promise.resolve(undefined),
                address.state != null && addressKeys.state ? stateService.findOne({ company: company._id, _id: new ObjectId(address.state), ...countryFilter }, {session, logger, languageCode, withDeleted: false}) : Promise.resolve(undefined),
                address.city != null && addressKeys.city ? cityService.findOneOrThrow({ company: company._id, _id: new ObjectId(address.city), ...countryFilter }, { session, logger, languageCode, withDeleted: false }) : Promise.resolve(undefined),
            ]);
            resolvedAddress = {
                ...address,
                country: foundCountry?._id,
                state: foundState?._id,
                city: foundCity?._id
            };
        }

        const resolvedParams = {
            ...params,
            project:            foundProject._id,
            investmentCurrency: foundCurrency._id,
            constructors:       foundConstructors?.map((constructor: IConstructor) => constructor._id),
            propertyTypes:      foundPropertyTypes?.map((propertyType: IUnitType) => propertyType._id),
            address:            resolvedAddress,
        };

        const data = buildUpdateDataFromSchemaDef(EdificeSchemaDef, {
            investmentValue:    (v) => Decimal128.fromString(String(v)),
        })(resolvedParams, writeFields);

        if (polygonCoordinates !== undefined && writeFields.polygonCoordinates) {
            data.polygonCoordinates = polygonCoordinates === null ? null : (polygonCoordinates.length > 0 ? polygonCoordinates : []);
        }
        if (energyClass !== undefined && writeFields.energyClass) {
            data.energyClass = energyClass === null ? null : energyClass;
        }

        return data;
    },
    actions: EdificeActions,
    beforeDelete: async () => {},
});
