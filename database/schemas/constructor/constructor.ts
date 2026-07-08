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
import {ConstructorSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.schema-def";
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
}

const ConstructorSchema: Schema = new Schema(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
        },
        email: {
            type: SchemaTypes.String,
            lowercase: true,
        },
        phoneNumber: {
            type: SchemaTypes.String,
            default: ""
        },
        addresses: {
            type: [{
                street: {
                    type: SchemaTypes.String,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                postalCode: {
                    type: SchemaTypes.String,
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
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                longitude: {
                    type: SchemaTypes.Number,
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
            type: SchemaTypes.String
        },
        vat: {
            type: SchemaTypes.String,
            required: true,
            unique: true,
        }
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
