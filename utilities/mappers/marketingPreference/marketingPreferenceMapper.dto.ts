import type {MarketingPreference} from "armonia/src/modules/propertyManagement/api/realEstate/private/marketingPreference/marketingPreference.dto";
import type {IMarketingPreference} from "../../../database/schemas/marketingPreference/marketingPreference";
import type {SimpleUser} from "armonia/src/modules/core/dto/user.dto";
import type {LeadSimple} from "armonia/src/modules/propertyManagement/dto/lead.dto";
import {SimpleUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {LeadSimpleSnippet} from "@propertyManagement/database/schemas/lead/lead.snippets";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function marketingPreferenceToDTO(doc: IMarketingPreference): MarketingPreference {
    return {
        _id:               doc._id.toString(),
        email:             doc.email,
        user:              mapSnippet<SimpleUser>()(doc.user, SimpleUserSnippet),
        lead:              mapSnippet<LeadSimple>()(doc.lead, LeadSimpleSnippet),
        // `!== false` so a row predating a flag reads as allowed, matching
        // `marketingPreferenceService.getState`.
        allowPriceChange:  doc.allowPriceChange !== false,
        allowOffers:       doc.allowOffers !== false,
        allowNewProjects:  doc.allowNewProjects !== false,
        unsubscribedAllAt: doc.unsubscribedAllAt ?? undefined,
        source:            doc.source ?? undefined,
        lastChangedAt:     doc.lastChangedAt ?? undefined,
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
