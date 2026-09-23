import type {MarketingPreference} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/marketingPreference.dto";
import type {IMarketingPreference} from "../../../database/schemas/marketingPreference/marketingPreference";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

const iso = (d: Date | string | undefined | null) => (d instanceof Date ? d.toISOString() : d ?? undefined);

export function marketingPreferenceToDTO(doc: IMarketingPreference): MarketingPreference {
    return {
        _id:               doc._id.toString(),
        email:             doc.email,
        user:              doc.user ? mapPopulatedRef(doc.user) : undefined,
        lead:              doc.lead ? mapPopulatedRef(doc.lead) : undefined,
        // `!== false` so a row predating a flag reads as allowed, matching
        // `marketingPreferenceService.getState`.
        allowPriceChange:  doc.allowPriceChange !== false,
        allowOffers:       doc.allowOffers !== false,
        allowNewProjects:  doc.allowNewProjects !== false,
        unsubscribedAllAt: iso(doc.unsubscribedAllAt),
        source:            doc.source ?? undefined,
        lastChangedAt:     iso(doc.lastChangedAt),
        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function marketingPreferencesToDTO(docs: IMarketingPreference[]): MarketingPreference[] {
    return docs.map(marketingPreferenceToDTO);
}

export function marketingPreferencesToSelect(docs: IMarketingPreference[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: doc.email,
    }));
}
