import {IConstructor} from "../../../database/schemas/constructor/constructor";
import {Constructor} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.dto";
import {mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {mapMedia, mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
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
        addresses: constructor.addresses && constructor.addresses.length > 0 ? constructor.addresses.map((address: any) => ({
            _id: address._id.toString(),
            street: address.street,
            postalCode: address.postalCode,
            city: mapPopulatedRef(address.city),
            state: mapPopulatedRef(address.state),
            country: mapPopulatedRef(address.country),
            latitude: address.latitude,
            longitude: address.longitude
        })) : undefined,
        ...mapSoftDeleteToDTO(constructor),
        ...mapOwnershipToDTO(constructor),
        logo: !!constructor.logo ? mapMedia(constructor.logo) : undefined,
        edifices: edifices && edifices.length > 0 ? edifices.map((edifice: any) => ({
            _id: edifice._id.toString(),
            name: edifice.name,
        })) : undefined
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
