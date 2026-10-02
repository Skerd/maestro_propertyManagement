import type {AdCampaign} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.dto";
import type {IAdCampaign} from "../../../database/schemas/adCampaign/adCampaign";
import type {SimpleUser} from "armonia/src/modules/core/dto/user.dto";
import type {AdCampaignTemplateSimple} from "armonia/src/modules/propertyManagement/dto/adCampaignTemplate.dto";
import type {LeadSimple} from "armonia/src/modules/propertyManagement/dto/lead.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {SimpleUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {AdCampaignTemplateSimpleSnippet} from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate.snippets";
import {LeadSimpleSnippet} from "@propertyManagement/database/schemas/lead/lead.snippets";
import {ProjectSimpleSnippet} from "@propertyManagement/database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "@propertyManagement/database/schemas/unit/unit.snippets";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

function mapSnippetList<Wire extends object>(
    list: unknown,
    snippet: {readonly keys: Readonly<Record<string, unknown>>},
): Wire[] | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list
        .map((item) => mapSnippet<Wire>()(item, snippet))
        .filter((item): item is Wire => !!item);
}

export function adCampaignToDTO(doc: IAdCampaign): AdCampaign {
    return {
        _id:                doc._id.toString(),
        name:               doc.name,
        title:              doc.title,
        campaignType:       doc.campaignType,
        status:             doc.status,

        template:           mapSnippet<AdCampaignTemplateSimple>()(doc.template, AdCampaignTemplateSimpleSnippet),
        subjectOverride:    doc.subjectOverride ?? undefined,
        bodyHtmlOverride:   doc.bodyHtmlOverride ?? undefined,

        audienceMode:       doc.audienceMode,
        recipients:         mapSnippetList<SimpleUser>(doc.recipients, SimpleUserSnippet),
        leadRecipients:     mapSnippetList<LeadSimple>(doc.leadRecipients, LeadSimpleSnippet),
        includeClientUsers: doc.includeClientUsers ?? undefined,
        includeLeads:       doc.includeLeads ?? undefined,

        projects:           mapSnippetList<ProjectSimple>(doc.projects, ProjectSimpleSnippet),
        units:              mapSnippetList<UnitSimple>(doc.units, UnitSimpleSnippet),

        contentUnit:        mapSnippet<UnitSimple>()(doc.contentUnit, UnitSimpleSnippet),
        contentProject:     mapSnippet<ProjectSimple>()(doc.contentProject, ProjectSimpleSnippet),
        offerTitle:         doc.offerTitle ?? undefined,
        offerEndsAt:        doc.offerEndsAt ?? undefined,
        ctaUrl:             doc.ctaUrl ?? undefined,

        scheduledAt:        doc.scheduledAt ?? undefined,
        startedAt:          doc.startedAt ?? undefined,
        completedAt:        doc.completedAt ?? undefined,

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
