import {PROPERTY_MANAGEMENT_KAFKA} from "@propertyManagement/environment";
import {publishEvent} from "@coreModule/kafka/kafkaProducer";
import {getLogger} from "@coreModule/loggers/serverLog";
import type {ReservationClientEmailEvent, SaleClientEmailEvent} from "@propertyManagement/kafka/types";

const logger = getLogger("propertyManagement_kafka_producer");

/** @returns false when not published, so the caller sends the email directly */
export function publishReservationClientEmailEvent(params: ReservationClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS.RESERVATION_CLIENT_EMAIL, params.userId.toString(), params, logger);
}

/** @returns false when not published, so the caller sends the email directly */
export function publishSaleClientEmailEvent(params: SaleClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS.SALE_CLIENT_EMAIL, params.userId.toString(), params, logger);
}
