/** propertyManagement Kafka topics — required only when this module is enabled. */
export const PROPERTY_MANAGEMENT_KAFKA = {
    TOPICS: {
        RESERVATION_CLIENT_EMAIL: process.env.KAFKA_TOPIC_RESERVATION_CLIENT_EMAIL,
        SALE_CLIENT_EMAIL: process.env.KAFKA_TOPIC_SALE_CLIENT_EMAIL,
    },
    CONSUMER_GROUP: {
        RESERVATION_CLIENT_EMAIL: process.env.KAFKA_CONSUMER_GROUP_RESERVATION_CLIENT_EMAIL,
        SALE_CLIENT_EMAIL: process.env.KAFKA_CONSUMER_GROUP_SALE_CLIENT_EMAIL,
    },
};
