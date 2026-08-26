import mongoose, {Document, Schema, SchemaTypes} from 'mongoose';
import {ICity} from "@coreModule/database/schemas/city/city";
import {ICountry} from "@coreModule/database/schemas/country/country";
import {IState} from "@coreModule/database/schemas/state/state";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {applyConstructorIndexes} from "./constructor.indexes";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {addModelData} from "@coreModule/database/collections";
import {constructorViews} from "./constructor.views";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    ConstructorSchemaDef,
    constructorPartyTypeValues,
    CONSTRUCTOR_LONG_TEXT_MAX,
    CONSTRUCTOR_PHONE_MAX,
    CONSTRUCTOR_POSTAL_CODE_MAX,
    CONSTRUCTOR_SHORT_TEXT_MAX,
    CONSTRUCTOR_STREET_MAX,
    CONSTRUCTOR_URL_MAX,
    CONSTRUCTOR_VAT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.schema-def";
import {CitySimpleSnippet} from "@coreModule/database/schemas/city/city.snippets";
import {StateSimpleSnippet} from "@coreModule/database/schemas/state/state.snippets";
import {CountrySimpleSnippet} from "@coreModule/database/schemas/country/country.snippets";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IConstructor extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    email: string;
    phoneNumber: string;
    addresses?: [{
        street?: string;
        postalCode?: string;
        city?: ICity;
        state?: IState;
        country?: ICountry;
        latitude?: number;
        longitude?: number;
    }];
    description: string;
    logo: IMedia;
    website: string;
    vat: string;
    company: ICompany;
    partyType?: (typeof constructorPartyTypeValues)[number];
    trades?: string;
    insuranceExpiry?: Date;
    performanceScore?: number;
}

const ConstructorSchema: Schema = new Schema(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: CONSTRUCTOR_SHORT_TEXT_MAX,
        },
        email: {
            type: SchemaTypes.String,
            lowercase: true,
            maxlength: 254,
        },
        phoneNumber: {
            type: SchemaTypes.String,
            default: "",
            maxlength: CONSTRUCTOR_PHONE_MAX,
        },
        addresses: {
            type: [{
                street: {
                    type: SchemaTypes.String,
                    trim: true,
                    minlength: 1,
                    maxlength: CONSTRUCTOR_STREET_MAX,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                postalCode: {
                    type: SchemaTypes.String,
                    trim: true,
                    minlength: 1,
                    maxlength: CONSTRUCTOR_POSTAL_CODE_MAX,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                city: {
                    type: SchemaTypes.ObjectId,
                    ref: "City",
                    refAllowlist: CitySimpleSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                state: {
                    type: SchemaTypes.ObjectId,
                    ref: "State",
                    refAllowlist: StateSimpleSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                country: {
                    type: SchemaTypes.ObjectId,
                    ref: "Country",
                    refAllowlist: CountrySimpleSnippet,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                latitude: {
                    type: SchemaTypes.Number,
                    min: -90,
                    max: 90,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                longitude: {
                    type: SchemaTypes.Number,
                    min: -180,
                    max: 180,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                }
            }],
            default: [],
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.ADDRESS
            },
        },
        description: {
            type: SchemaTypes.String,
            maxlength: CONSTRUCTOR_LONG_TEXT_MAX,
        },
        logo: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false
            },
            refAllowlist: MediaSimpleSnippet
        },
        website: {
            type: SchemaTypes.String,
            trim: true,
            maxlength: CONSTRUCTOR_URL_MAX,
        },
        vat: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
            trim: true,
            minlength: 1,
            maxlength: CONSTRUCTOR_VAT_MAX,
        },
        partyType: {
            type: SchemaTypes.String,
            enum: [...constructorPartyTypeValues],
            required: false,
        },
        trades: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
            maxlength: CONSTRUCTOR_SHORT_TEXT_MAX,
        },
        insuranceExpiry: {
            type: SchemaTypes.Date,
            required: false,
        },
        performanceScore: {
            type: SchemaTypes.Number,
            required: false,
            min: 0,
            max: 100,
        },
    },
    {
        accessMode: "loose"
    }
);

ownershipPlugin(ConstructorSchema);
auditPlugin(ConstructorSchema);
softDeletePlugin(ConstructorSchema);
lifeCyclePlugin(ConstructorSchema);
applyConstructorIndexes(ConstructorSchema);
const Constructor = mongoose.model<IConstructor>('Constructor', ConstructorSchema);
normalizeSchemaPermissions(Constructor);
export default Constructor;

addModelData(Constructor, constructorViews);
validateSchemaDefAgainstMongoose(ConstructorSchema, ConstructorSchemaDef, "Constructor", ["company"]);
