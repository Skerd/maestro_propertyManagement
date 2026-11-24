import {emailEventType} from "@coreModule/kafka/kafkaProducer";
import {
    publishConstructionProgressClientEmailEvent,
    publishInquiryClientEmailEvent,
    publishSalesStaffAlertEmailEvent,
    staffAlertEventType,
} from "@propertyManagement/kafka/kafkaProducer";
import type {ConstructionProgressClientEmailEvent} from "@propertyManagement/kafka/types";
import {sendInquiryClientMail, type InquiryClientEmail} from "@propertyManagement/utilities/emails/inquiryNotifiers";
import {sendSalesStaffAlertMail, type SalesStaffAlertEmail} from "@propertyManagement/utilities/emails/staffAlertNotifiers";
import {sendConstructionProgressClientMail} from "@propertyManagement/utilities/emails/constructionProgressNotifiers";
import {loadInlineImageAttachments, type InlineImageAttachment} from "@propertyManagement/utilities/emails/mediaImageAttachments";

/*
 * The emails below go through their kind's Kafka topic, so they survive a restart and are retried (D188), and are sent
 * directly when Kafka is off or the publish fails.
 */

/** A website visitor's inquiry confirmation. */
export async function dispatchInquiryClientEmail(data: InquiryClientEmail): Promise<void> {
    const event = {...data, eventType: emailEventType("INQUIRY_CLIENT_EMAIL"), timestamp: Date.now()};
    if (!(await publishInquiryClientEmailEvent(event))) await sendInquiryClientMail(data);
}

/** A staff watcher's sale or reservation alert. */
export async function dispatchSalesStaffAlertEmail(data: SalesStaffAlertEmail): Promise<void> {
    const event = {...data, eventType: staffAlertEventType(data.kind), timestamp: Date.now()};
    if (!(await publishSalesStaffAlertEmailEvent(event))) await sendSalesStaffAlertMail(data);
}

/**
 * Sends a construction update from its event, with the site photos loaded by id: what the consumer runs. The direct
 * fallback passes the photos it already loaded once for every client.
 */
export async function sendConstructionProgressClientEmailEvent(event: ConstructionProgressClientEmailEvent, photos?: InlineImageAttachment[]): Promise<void> {
    const loaded = photos ?? await loadInlineImageAttachments(event.photoIds, {languageCode: event.languageCode, cidPrefix: "site"});
    await sendConstructionProgressClientMail({...event, photos: loaded});
}

/** A construction update to one client; `photos` loads the photos (once) for a direct send. */
export async function dispatchConstructionProgressClientEmail(event: ConstructionProgressClientEmailEvent, photos: () => Promise<InlineImageAttachment[]>): Promise<void> {
    if (!(await publishConstructionProgressClientEmailEvent(event))) await sendConstructionProgressClientEmailEvent(event, await photos());
}
