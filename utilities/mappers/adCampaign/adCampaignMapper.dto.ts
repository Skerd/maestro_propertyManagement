import type {AdCampaign} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.dto";
import type {IAdCampaign} from "../../../database/schemas/adCampaign/adCampaign";
import {mapPopulatedRef} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

const iso = (d: Date | string | undefined | null) => (d instanceof Date ? d.toISOString() : d ?? undefined);

/** Populated ref arrays map one-by-one; an unpopulated ObjectId yields `{_id}`. */
function mapRefs(list: unknown): any[] | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list.map(item => mapPopulatedRef(item as any));
}

export function adCampaignToDTO(doc: IAdCampaign): AdCampaign {
    return {
        _id:                doc._id.toString(),
        name:               doc.name,
        title:              doc.title,
        campaignType:       doc.campaignType,
        status:             doc.status,

        template:           mapPopulatedRef(doc.template),
        subjectOverride:    doc.subjectOverride ?? undefined,
        bodyHtmlOverride:   doc.bodyHtmlOverride ?? undefined,

        audienceMode:       doc.audienceMode,
        recipients:         mapRefs(doc.recipients),
        leadRecipients:     mapRefs(doc.leadRecipients),
        includeClientUsers: doc.includeClientUsers ?? undefined,
        includeLeads:       doc.includeLeads ?? undefined,

        projects:           mapRefs(doc.projects),
        units:              mapRefs(doc.units),

        scheduledAt:        iso(doc.scheduledAt),
        startedAt:          iso(doc.startedAt),
        completedAt:        iso(doc.completedAt),

        batchSize:          doc.batchSize ?? undefined,
        fromName:           doc.fromName ?? undefined,
        replyTo:            doc.replyTo ?? undefined,

        stats:              doc.stats
            ? {
                  total:   doc.stats.total ?? 0,
                  pending: doc.stats.pending ?? 0,
                  sent:    doc.stats.sent ?? 0,
                  failed:  doc.stats.failed ?? 0,
                  skipped: doc.stats.skipped ?? 0,
              }
            : undefined,
        lastError:          doc.lastError ?? undefined,

        ...mapOwnershipToDTO(doc),
        ...mapSoftDeleteToDTO(doc),
        ...mapLifeCycleToDTO(doc),
    };
}

export function adCampaignsToDTO(docs: IAdCampaign[]): AdCampaign[] {
    return docs.map(adCampaignToDTO);
}
