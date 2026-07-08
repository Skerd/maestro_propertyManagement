import {getProducerInstance} from "@coreModule/connections/connectToKafka";
import {KAFKA} from "@coreModule/environment";
import {canPublish, publishWithRetry} from "@coreModule/kafka/kafkaProducer";
import {getLogger} from "@coreModule/loggers/serverLog";
import type {ReservationClientEmailEvent, SaleClientEmailEvent} from "@propertyManagement/kafka/types";

const logger = getLogger("propertyManagement_kafka_producer");

export async function publishReservationClientEmailEvent(params: ReservationClientEmailEvent): Promise<void> {

    if (!canPublish(logger)) {
        return;
    }

    const producer = getProducerInstance();
    const topic = KAFKA.TOPICS.RESERVATION_CLIENT_EMAIL;
    if (!producer || !topic) {
        logger.warn("Kafka producer or topic not available, skipping reservation client email event");
        return;
    }

    try {
        await publishWithRetry(
            topic,
            {
                key: params.userId.toString(),
                value: JSON.stringify(params),
                headers: {
                    "event-type": "reservation_client_email",
                    "timestamp": new Date(params.timestamp).toISOString(),
                },
            },
            KAFKA.PRODUCER_MAX_RETRIES,
            logger
        );

        logger.debug(`Published reservation client email event for user ${params.userId}`);
    }
    catch (error: any) {
        logger.err(`Failed to publish reservation client email event for user ${params.userId}: ${error.message}`);
    }

}

export async function publishSaleClientEmailEvent(params: SaleClientEmailEvent): Promise<void> {

    if (!canPublish(logger)) {
        return;
    }

    const producer = getProducerInstance();
    const topic = KAFKA.TOPICS.SALE_CLIENT_EMAIL;
    if (!producer || !topic) {
        logger.warn("Kafka producer or topic not available, skipping sale client email event");
        return;
    }

    try {
        await publishWithRetry(
            topic,
            {
                key: params.userId.toString(),
                value: JSON.stringify(params),
                headers: {
                    "event-type": "sale_client_email",
                    "timestamp": new Date(params.timestamp).toISOString(),
                },
            },
            KAFKA.PRODUCER_MAX_RETRIES,
            logger
        );

        logger.debug(`Published sale client email event for user ${params.userId}`);
    }
    catch (error: any) {
        logger.err(`Failed to publish sale client email event for user ${params.userId}: ${error.message}`);
    }

}
