import {KAFKA} from "@coreModule/environment";
import {PROPERTY_MANAGEMENT_KAFKA} from "@propertyManagement/environment";
import {addKafkaTopicConsumer, emailTopicSpec, startKafkaTopicConsumers} from "@coreModule/kafka/kafkaConsumer";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import type {
    InquiryClientEmailEvent,
    LeaseClientEmailEvent,
    ReservationClientEmailEvent,
    SaleClientEmailEvent,
    SalesStaffAlertEmailEvent,
    ConstructionProgressClientEmailEvent,
} from "./types";
import {sendReservationClientMail} from "@propertyManagement/utilities/emails/notifiers";
import {sendSaleClientMail} from "@propertyManagement/utilities/emails/saleNotifiers";
import {sendLeaseClientMail} from "@propertyManagement/utilities/emails/leaseNotifiers";
import {sendInquiryClientMail} from "@propertyManagement/utilities/emails/inquiryNotifiers";
import {sendSalesStaffAlertMail} from "@propertyManagement/utilities/emails/staffAlertNotifiers";
import {sendConstructionProgressClientEmailEvent} from "@propertyManagement/utilities/emails/emailDispatch";
import {LEASE_EMAIL_TOPIC_BY_KIND, STAFF_ALERT_TOPIC_BY_KIND} from "./kafkaProducer";

const logger = getLogger("propertyManagement_kafka_consumer");

async function processReservationClientEmailEvent(event: ReservationClientEmailEvent): Promise<void> {
    try {
        await sendReservationClientMail(event);
        logger.debug(`Processed reservation email event for user ${event.userId}`);
    }
    catch (error: any) {
        logger.err(`Failed to process reservation email event: ${error.message}`);
        throw error; // Re-throw to trigger retry mechanism
    }
}

async function processSaleClientEmailEvent(event: SaleClientEmailEvent): Promise<void> {
    try {
        await sendSaleClientMail(event);
        logger.debug(`Processed sale client email event for user ${event.userId}`);
    } catch (error: any) {
        logger.err(`Failed to process sale client email event: ${error.message}`);
        throw error;
    }
}

export async function startRealEstateKafkaConsumers(parentLogger?: serverLogger): Promise<void> {

    if (!KAFKA.ENABLED) {
        const log = getLogger("propertyManagement_kafka_consumers", parentLogger);
        log.warn("Kafka is disabled; skipping real estate consumers.");
        return;
    }

    const umbrellaLog = getLogger("propertyManagement_kafka_consumers", parentLogger);
    umbrellaLog.start("Starting real estate Kafka consumers");

    try {
        await addKafkaTopicConsumer(parentLogger, {
            registryKey: "reservationClientEmail",
            displayName: "Reservation client email",
            groupId: PROPERTY_MANAGEMENT_KAFKA.CONSUMER_GROUP.RESERVATION_CLIENT_EMAIL,
            topic: PROPERTY_MANAGEMENT_KAFKA.TOPICS.RESERVATION_CLIENT_EMAIL,
            expectedEventType: "reservation_client_email",
            processEvent: (d) => processReservationClientEmailEvent(d as ReservationClientEmailEvent),
        });
    } catch (err: any) {
        umbrellaLog.err(`Reservation client email consumer failed: ${err?.message}`);
    }

    try {
        await addKafkaTopicConsumer(parentLogger, {
            registryKey: "saleClientEmail",
            displayName: "Sale client email",
            groupId: PROPERTY_MANAGEMENT_KAFKA.CONSUMER_GROUP.SALE_CLIENT_EMAIL,
            topic: PROPERTY_MANAGEMENT_KAFKA.TOPICS.SALE_CLIENT_EMAIL,
            expectedEventType: "sale_client_email",
            processEvent: (d) => processSaleClientEmailEvent(d as SaleClientEmailEvent),
        });
    } catch (err: any) {
        umbrellaLog.err(`Sale client email consumer failed: ${err?.message}`);
    }

    // The newer emails, one topic per kind (D188).
    await startKafkaTopicConsumers(parentLogger, umbrellaLog, [
        ...Object.values(LEASE_EMAIL_TOPIC_BY_KIND).map((topicKey) =>
            emailTopicSpec(PROPERTY_MANAGEMENT_KAFKA, topicKey, (event) => sendLeaseClientMail(event as LeaseClientEmailEvent))),
        emailTopicSpec(PROPERTY_MANAGEMENT_KAFKA, "INQUIRY_CLIENT_EMAIL", (event) => sendInquiryClientMail(event as InquiryClientEmailEvent)),
        ...Object.values(STAFF_ALERT_TOPIC_BY_KIND).map((topicKey) =>
            emailTopicSpec(PROPERTY_MANAGEMENT_KAFKA, topicKey, (event) => sendSalesStaffAlertMail(event as SalesStaffAlertEmailEvent))),
        emailTopicSpec(PROPERTY_MANAGEMENT_KAFKA, "CONSTRUCTION_PROGRESS_CLIENT_EMAIL", (event) =>
            sendConstructionProgressClientEmailEvent(event as ConstructionProgressClientEmailEvent)),
    ]);

    umbrellaLog.finish("Real estate Kafka consumers startup pass complete");
}
