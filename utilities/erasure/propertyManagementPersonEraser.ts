import {
    objectIds as ids,
    registerPersonEraser,
    type ErasureContext,
    type ErasureCount,
} from "@coreModule/utilities/erasure/personErasure";
import {leadService} from "@propertyManagement/database/schemas/lead/lead.service";
import {marketingPreferenceService} from "@propertyManagement/database/schemas/marketingPreference/marketingPreference.service";
import {adCampaignRecipientService} from "@propertyManagement/database/schemas/adCampaignRecipient/adCampaignRecipient.service";
import {reservationService} from "@propertyManagement/database/schemas/reservation/reservation.service";
import {saleService} from "@propertyManagement/database/schemas/sale/sale.service";

/**
 * A real-estate company's records of one person (D57): leads and campaign send records are deleted; a marketing
 * preference stays as "unsubscribed from everything" with only the email, so the person is never mailed again;
 * reservations and sales stay for their contracts and amounts and lose their free-text notes (their buyer is the
 * person's login account, removed by the separate account deletion).
 */
async function erasePropertyManagementPerson(ctx: ErasureContext): Promise<ErasureCount[]> {
    const {companyId, subject, preview, session} = ctx;
    const found = {session, withDeleted: true};

    const leads = subject.emails.length > 0 ? await leadService.find({company: companyId, email: {$in: subject.emails}}, found, undefined, "_id") : [];
    const leadIds = ids(leads);
    const recipients = await adCampaignRecipientService.find({
        company: companyId,
        $or: [{user: {$in: subject.accountIds}}, {email: {$in: subject.emails}}, {lead: {$in: leadIds}}],
    }, found, undefined, "_id");
    const preferences = await marketingPreferenceService.find({
        company: companyId,
        $or: [{user: {$in: subject.accountIds}}, {email: {$in: subject.emails}}, {lead: {$in: leadIds}}],
    }, found, undefined, "_id");
    const reservations = subject.accountIds.length > 0 ? await reservationService.find({company: companyId, client: {$in: subject.accountIds}}, found, undefined, "_id") : [];
    const sales = subject.accountIds.length > 0 ? await saleService.find({company: companyId, buyer: {$in: subject.accountIds}}, found, undefined, "_id") : [];

    const counts: ErasureCount[] = [
        {collection: "leads", anonymised: 0, deleted: leads.length},
        {collection: "adcampaignrecipients", anonymised: 0, deleted: recipients.length},
        {collection: "marketingpreferences", anonymised: preferences.length, deleted: 0},
        {collection: "reservations", anonymised: reservations.length, deleted: 0},
        {collection: "sales", anonymised: sales.length, deleted: 0},
    ];
    if (preview) return counts;

    if (leads.length > 0) {
        await leadService.deleteMany({company: companyId, _id: {$in: leadIds}}, {session, hard: true});
        ctx.scrubAudit("leads", leadIds, "all");
    }
    if (recipients.length > 0) {
        await adCampaignRecipientService.deleteMany({company: companyId, _id: {$in: ids(recipients)}}, {session, hard: true});
        ctx.scrubAudit("adcampaignrecipients", ids(recipients), "all");
    }
    if (preferences.length > 0) {
        await marketingPreferenceService.eraseFields({company: companyId, _id: {$in: ids(preferences)}}, {
            $set: {unsubscribedAllAt: new Date(), allowPriceChange: false, allowOffers: false, allowNewProjects: false},
            $unset: {lead: ""},
        }, {session});
    }
    if (reservations.length > 0) {
        await reservationService.eraseFields({company: companyId, _id: {$in: ids(reservations)}}, {$unset: {reservationNotes: ""}}, {session});
        ctx.scrubAudit("reservations", ids(reservations), ["reservationNotes"]);
    }
    if (sales.length > 0) {
        await saleService.eraseFields({company: companyId, _id: {$in: ids(sales)}}, {$unset: {notes: ""}}, {session});
        ctx.scrubAudit("sales", ids(sales), ["notes"]);
    }
    return counts;
}

export function registerPropertyManagementPersonErasers(): void {
    registerPersonEraser({module: "propertyManagement", erase: erasePropertyManagementPerson});
}
