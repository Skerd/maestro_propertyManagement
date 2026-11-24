import {PROPERTY_MANAGEMENT_KAFKA} from "@propertyManagement/environment";
import {emailEventType, publishEvent} from "@coreModule/kafka/kafkaProducer";
import {getLogger} from "@coreModule/loggers/serverLog";
import type {
    ConstructionProgressClientEmailEvent,
    InquiryClientEmailEvent,
    LeaseClientEmailEvent,
    ReservationClientEmailEvent,
    SaleClientEmailEvent,
    SalesStaffAlertEmailEvent,
} from "@propertyManagement/kafka/types";

const logger = getLogger("propertyManagement_kafka_producer");

/** @returns false when not published, so the caller sends the email directly */
export function publishReservationClientEmailEvent(params: ReservationClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS.RESERVATION_CLIENT_EMAIL, params.userId.toString(), params, logger);
}

/** @returns false when not published, so the caller sends the email directly */
export function publishSaleClientEmailEvent(params: SaleClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS.SALE_CLIENT_EMAIL, params.userId.toString(), params, logger);
}

type TopicKey = keyof typeof PROPERTY_MANAGEMENT_KAFKA.TOPICS;

/** Each rent email kind's own topic (D188). */
export const LEASE_EMAIL_TOPIC_BY_KIND: Record<LeaseClientEmailEvent["kind"], TopicKey> = {
    rent_reminder: "RENT_REMINDER_EMAIL",
    rent_remaining_days: "RENT_REMAINING_DAYS_EMAIL",
    rent_overdue: "RENT_OVERDUE_EMAIL",
};

/** Each staff alert kind's own topic (D188). */
export const STAFF_ALERT_TOPIC_BY_KIND: Record<SalesStaffAlertEmailEvent["kind"], TopicKey> = {
    sale_created: "SALE_CREATED_STAFF_EMAIL",
    reservation_created: "RESERVATION_CREATED_STAFF_EMAIL",
    reservation_expired: "RESERVATION_EXPIRED_STAFF_EMAIL",
};

export function leaseEmailEventType(kind: LeaseClientEmailEvent["kind"]): string {
    return emailEventType(LEASE_EMAIL_TOPIC_BY_KIND[kind]);
}

export function staffAlertEventType(kind: SalesStaffAlertEmailEvent["kind"]): string {
    return emailEventType(STAFF_ALERT_TOPIC_BY_KIND[kind]);
}

/** A rent email on its kind's topic, keyed by the lease. @returns false when not published, so the caller sends it directly */
export function publishLeaseClientEmailEvent(params: LeaseClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS[LEASE_EMAIL_TOPIC_BY_KIND[params.kind]], params.leaseId, params, logger);
}

/** A website inquiry confirmation, keyed by the visitor's email. @returns false when not published, so the caller sends it directly */
export function publishInquiryClientEmailEvent(params: InquiryClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS.INQUIRY_CLIENT_EMAIL, params.email, params, logger);
}

/** A staff alert on its kind's topic, keyed by the sale or reservation. @returns false when not published, so the caller sends it directly */
export function publishSalesStaffAlertEmailEvent(params: SalesStaffAlertEmailEvent): Promise<boolean> {
    const recordId = params.kind === "sale_created" ? params.saleId : params.reservationId;
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS[STAFF_ALERT_TOPIC_BY_KIND[params.kind]], recordId, params, logger);
}

/** A construction update to one client, keyed by the report. @returns false when not published, so the caller sends it directly */
export function publishConstructionProgressClientEmailEvent(params: ConstructionProgressClientEmailEvent): Promise<boolean> {
    return publishEvent(PROPERTY_MANAGEMENT_KAFKA.TOPICS.CONSTRUCTION_PROGRESS_CLIENT_EMAIL, params.constructionProgressId, params, logger);
}
