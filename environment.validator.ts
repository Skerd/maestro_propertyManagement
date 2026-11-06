import type {ModuleEnvironmentContext, ValidationError} from "@coreModule/environment/validator";

/** propertyManagement's boot checks (D67): the client-email Kafka topics, while Kafka is on. */
export function validateEnvironment({env, kafkaEnabled, validateString}: ModuleEnvironmentContext): ValidationError[] {
    if (!kafkaEnabled) return [];
    return [
        validateString("KAFKA_TOPIC_RESERVATION_CLIENT_EMAIL", env.KAFKA_TOPIC_RESERVATION_CLIENT_EMAIL, true),
        validateString("KAFKA_TOPIC_SALE_CLIENT_EMAIL", env.KAFKA_TOPIC_SALE_CLIENT_EMAIL, true),
        validateString("KAFKA_CONSUMER_GROUP_RESERVATION_CLIENT_EMAIL", env.KAFKA_CONSUMER_GROUP_RESERVATION_CLIENT_EMAIL, true),
        validateString("KAFKA_CONSUMER_GROUP_SALE_CLIENT_EMAIL", env.KAFKA_CONSUMER_GROUP_SALE_CLIENT_EMAIL, true),
    ].filter((error): error is ValidationError => error !== null);
}
