import {kafkaTopicErrors, type ModuleEnvironmentContext, type ValidationError} from "@coreModule/environment/validator";
import {PROPERTY_MANAGEMENT_KAFKA} from "@propertyManagement/environment";

/** propertyManagement's boot checks (D67): the client and staff email Kafka topics, while Kafka is on (D188). */
export function validateEnvironment(ctx: ModuleEnvironmentContext): ValidationError[] {
    return kafkaTopicErrors(ctx, PROPERTY_MANAGEMENT_KAFKA);
}
