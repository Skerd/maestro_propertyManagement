import {KAFKA} from "@coreModule/environment";
import {addKafkaTopicConsumer} from "@coreModule/kafka/kafkaConsumer";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import type {ReservationClientEmailEvent, SaleClientEmailEvent} from "./types";
import {sendReservationClientMail} from "@propertyManagement/utilities/emails/notifiers";
import {sendSaleClientMail} from "@propertyManagement/utilities/emails/saleNotifiers";

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
            groupId: KAFKA.CONSUMER_GROUP.RESERVATION_CLIENT_EMAIL,
            topic: KAFKA.TOPICS.RESERVATION_CLIENT_EMAIL,
            expectedEventType: "reservation_client_email",
            processEvent: (d) => processReservationClientEmailEvent(d as ReservationClientEmailEvent),
        });
        await addKafkaTopicConsumer(parentLogger, {
            registryKey: "saleClientEmail",
            displayName: "Sale client email",
            groupId: KAFKA.CONSUMER_GROUP.SALE_CLIENT_EMAIL,
            topic: KAFKA.TOPICS.SALE_CLIENT_EMAIL,
            expectedEventType: "sale_client_email",
            processEvent: (d) => processSaleClientEmailEvent(d as SaleClientEmailEvent),
        });
    } catch (err: any) {
        umbrellaLog.err(`Reservation client email consumer failed: ${err?.message}`);
    }

    umbrellaLog.finish("Real estate Kafka consumers startup pass complete");
}
