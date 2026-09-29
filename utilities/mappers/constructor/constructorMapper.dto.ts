import {IConstructor} from "../../../database/schemas/constructor/constructor";
import {Constructor} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.dto";
import type {CitySimple} from "armonia/src/modules/core/dto/city.dto";
import type {CountrySimple} from "armonia/src/modules/core/dto/country.dto";
import type {StateSimple} from "armonia/src/modules/core/dto/state.dto";
import type {EdificeBlank} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import {CitySimpleSnippet} from "@coreModule/database/schemas/city/city.snippets";
import {CountrySimpleSnippet} from "@coreModule/database/schemas/country/country.snippets";
import {StateSimpleSnippet} from "@coreModule/database/schemas/state/state.snippets";
import {EdificeSnippet} from "@propertyManagement/database/schemas/edifice/edifice.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {IEdifice} from "../../../database/schemas/edifice/edifice";

export function constructorToDTO(constructor: IConstructor, edifices?: IEdifice[]): Constructor {
    return {
        _id: constructor._id.toString(),
        name: constructor.name,
        email: constructor.email,
        phoneNumber: constructor.phoneNumber,
        website: constructor.website,
        description: constructor.description,
        vat: constructor.vat,
        addresses: constructor.addresses && constructor.addresses.length > 0 ? constructor.addresses.map((address) => ({
            _id: (address as {_id?: {toString(): string}})._id?.toString() ?? "",
            street: address.street,
            postalCode: address.postalCode,
            city: mapSnippet<CitySimple>()(address.city, CitySimpleSnippet),
            state: mapSnippet<StateSimple>()(address.state, StateSimpleSnippet),
            country: mapSnippet<CountrySimple>()(address.country, CountrySimpleSnippet),
            latitude: address.latitude,
            longitude: address.longitude
        })) : undefined,
        partyType: constructor.partyType,
        trades: constructor.trades,
        insuranceExpiry: constructor.insuranceExpiry instanceof Date ? constructor.insuranceExpiry.toISOString() : (constructor as any).insuranceExpiry ?? undefined,
        performanceScore: constructor.performanceScore,
        ...mapSoftDeleteToDTO(constructor),
        ...mapOwnershipToDTO(constructor),
        ...mapLifeCycleToDTO(constructor),
        logo: !!constructor.logo ? mapMedia(constructor.logo) : undefined,
        edifices: edifices && edifices.length > 0
            ? edifices
                .map((edifice) => mapSnippet<EdificeBlank>()(edifice, EdificeSnippet))
                .filter((edifice): edifice is EdificeBlank => !!edifice)
            : undefined
    };
}

export function constructorsToDTO(constructors: IConstructor[], edificesMap?: Map<string, IEdifice[]>): Constructor[] {
    const out: Constructor[] = [];
    for (const c of constructors) {
        const constructorId = c._id.toString();
        const edifices = edificesMap?.get(constructorId) || [];
        out.push(constructorToDTO(c, edifices));
    }
    return out;
}
