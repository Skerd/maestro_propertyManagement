import {Document, model, Schema, SchemaTypes} from 'mongoose';
import {Decimal128} from "mongodb";
import {IState} from "@coreModule/database/schemas/state/state";
import {ICountry} from "@coreModule/database/schemas/country/country";
import {ICity} from "@coreModule/database/schemas/city/city";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IConstructor} from "../constructor/constructor";
import {IUnitType} from "../unitType/unitType";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields
} from "@coreModule/database/types/plugin-fields";
import {applyEdificeIndexes} from "./edifice.indexes";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {IProject} from "../project/project";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {addModelData} from "@coreModule/database/collections";
import {edificeViews} from "./edifice.views";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {EdificeSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.schema-def";
import {EDIFICE_ENERGY_CLASS_VALUES, EdificeEnergyClass} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.constants";
import {CountrySimpleSnippet} from "@coreModule/database/schemas/country/country.snippets";
import {StateSimpleSnippet} from "@coreModule/database/schemas/state/state.snippets";
import {CitySimpleSnippet} from "@coreModule/database/schemas/city/city.snippets";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {ConstructorSimpleSnippet} from "../constructor/constructor.snippets";
import {UnitTypeSimpleSnippet} from "../unitType/unitType.snippets";
import {ProjectSimpleSnippet, ProjectWithImageSnippet} from "../project/project.snippets";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";

export interface IEdifice extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    mainImage: IMedia, // main edifice image, used to hover over and select floors
    imageGallery: IMedia[], // image gallery for the edifice
    videoGallery: IMedia[], // video gallery for the edifice
    mediaFiles?: IMedia[], // generic file attachments (PDFs, documents, etc.)
    marketingBooklet?: IMedia, // single marketing booklet PDF
    name: string,
    address: {
        street: string,
        postalCode: string,
        country: ICountry,
        state?: IState,
        city: ICity,
        latitude: number,
        longitude: number
    },
    distanceFromCityCenter: number, //in meters
    totalArea: number, // in square meters
    greenArea: number,
    numberOfFloors?: number,
    numberOfParkingSpaces?: number,
    numberOfGarages?: number,
    numberOfFloorsAboveGround?: number,
    numberOfFloorsUnderGround?: number,
    commercialFacilities: string[],
    neighborhoodFacilities: string[],
    investmentValue: Decimal128, // sensitive
    investmentCurrency: ICurrency, // sensitive
    pricePerMeterSquared?: number, // sale price per m² of unit area
    verandaPricePerMeterSquared?: number, // sale price per m² of veranda area
    saleCurrency?: ICurrency, // currency used for unit sale pricing
    constructors: IConstructor[], // sensitive (designer, prizes)
    propertyTypes: IUnitType[],
    polygonCoordinates?: {x: number; y: number}[],
    project: IProject,
    constructionStartDate?: Date,
    expectedCompletionDate?: Date,
    actualCompletionDate?: Date,
    buildingPermitNumber?: string,
    energyClass?: EdificeEnergyClass,
}

const EdificeSchema = new Schema<IEdifice>(
    {
        mainImage: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: true,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.AVATAR
        }
        },
        imageGallery: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.AVATAR,
            }
        },
        videoGallery: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
            }
        },
        mediaFiles: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                visible: false,
            }
        },
        marketingBooklet: {
            type: SchemaTypes.ObjectId,
            ref: "Media",
            required: false,
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                visible: false,
            },
        },
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true
        },
        address: {
            type: {
                street: {
                    type: SchemaTypes.String,
                    required: true,
                    trim: true,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                postalCode: {
                    type: SchemaTypes.String,
                    required: true,
                    trim: true,
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
                state: {
                    type: SchemaTypes.ObjectId,
                    ref: "State",
                    refAllowlist: StateSimpleSnippet,
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
                latitude: {
                    type: SchemaTypes.Number,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                },
                longitude: {
                    type: SchemaTypes.Number,
                    required: true,
                    dynamicTableConfiguration: {
                        hideColumn: true
                    }
                }
            },
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                cellType: COLUMN_TYPE.ADDRESS
            },
            required: true
        },
        distanceFromCityCenter: {
            type: SchemaTypes.Number
        },
        totalArea: {
            type: SchemaTypes.Number
        },
        greenArea: {
            type: SchemaTypes.Number
        },
        numberOfFloors: {
            type: SchemaTypes.Number
        },
        numberOfParkingSpaces: {
            type: SchemaTypes.Number
        },
        numberOfGarages: {
            type: SchemaTypes.Number
        },
        numberOfFloorsAboveGround: {
            type: SchemaTypes.Number
        },
        numberOfFloorsUnderGround: {
            type: SchemaTypes.Number
        },
        commercialFacilities: {
            type: [SchemaTypes.String],
            default: [],
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
            }
        },
        neighborhoodFacilities: {
            type: [SchemaTypes.String],
            default: [],
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
            }
        },
        investmentValue: {
            type: SchemaTypes.Decimal128,
            required: true,
            set: (v: number | string | Decimal128) => {
                if (v instanceof Decimal128) return v;
                return Decimal128.fromString(v.toString());
            },
            validate: {
                validator: function(value: Decimal128) {
                    if (!value) return false;
                    const numValue = parseFloat(value.toString());
                    return numValue >= 0;
                },
                message: 'Investment value must be non-negative'
            }
        },
        investmentCurrency: {
            type: SchemaTypes.ObjectId,
            ref: 'Currency',
            required: true,
            refAllowlist: CurrencySimpleSnippet
        },
        pricePerMeterSquared: {
            type: SchemaTypes.Number,
            required: false,
            min: 0
        },
        verandaPricePerMeterSquared: {
            type: SchemaTypes.Number,
            required: false,
            min: 0
        },
        saleCurrency: {
            type: SchemaTypes.ObjectId,
            ref: 'Currency',
            required: false,
            refAllowlist: CurrencySimpleSnippet
        },
        constructors: [{
            type: SchemaTypes.ObjectId,
            ref: 'Constructor',
            refAllowlist: ConstructorSimpleSnippet
        }],
        propertyTypes: {
            type: [SchemaTypes.ObjectId],
            ref: 'UnitType',
            refAllowlist: UnitTypeSimpleSnippet
        },
        polygonCoordinates: {
            type: [{
                x: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: 0,
                    max: 1,
                    dynamicTableConfiguration: {
                        filterable: false,
                        sortable: false,
                        hideColumn: true
                    }
                },
                y: {
                    type: SchemaTypes.Number,
                    required: true,
                    min: 0,
                    max: 1,
                    dynamicTableConfiguration: {
                        filterable: false,
                        sortable: false,
                        hideColumn: true
                    }
                }
            }],
            required: false,
            default: undefined,
            validate: {
                validator: function(value: {x: number, y: number}[]) {
                    if (!value || value.length === 0) return true;
                    return value.length >= 3;
                },
                message: 'Polygon coordinates must have at least 3 points'
            },
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false,
                sortable: false,
                visible: false,
            }
        },
        project: {
            type: SchemaTypes.ObjectId,
            ref: 'Project',
            required: true,
            refAllowlist: ProjectWithImageSnippet
        },
        constructionStartDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
        expectedCompletionDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
        actualCompletionDate: {
            type: SchemaTypes.Date,
            required: false,
            index: true,
        },
        buildingPermitNumber: {
            type: SchemaTypes.String,
            required: false,
            trim: true,
        },
        energyClass: {
            type: SchemaTypes.String,
            enum: [...EDIFICE_ENERGY_CLASS_VALUES],
            required: false,
            index: true,
            dynamicTableConfiguration: { hideColumn: true },
        },
    },
    {
        accessMode: "loose"
    }
);

ownershipPlugin(EdificeSchema);
auditPlugin(EdificeSchema);
softDeletePlugin(EdificeSchema);
lifeCyclePlugin(EdificeSchema);
applyEdificeIndexes(EdificeSchema);
EdificeSchema.path('investmentValue').get(function(v: Decimal128) {
    // (fixes TypeScript compatibility)
    return v ? parseFloat(v.toString()) : null;
});

const Edifice = model<IEdifice>('Edifice', EdificeSchema);
normalizeSchemaPermissions(Edifice);
export default Edifice;

addModelData(Edifice, edificeViews);
validateSchemaDefAgainstMongoose(EdificeSchema, EdificeSchemaDef, "Edifice");