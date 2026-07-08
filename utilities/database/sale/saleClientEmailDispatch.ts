import type {ClientSession} from "mongodb";
import {ObjectId} from "mongodb";
import {isKafkaConnected} from "@coreModule/connections/connectToKafka";
import {userService} from "@coreModule/database/schemas/user/user.service";
import type {SaleClientEmailEvent} from "../../../kafka/types";
import {publishSaleClientEmailEvent} from "../../../kafka/kafkaProducer";
import {formatReservationExpirationForEmail} from "../reservation/reservationClientEmailDispatch";
import {sendSaleClientMail} from "@propertyManagement/utilities/emails/saleNotifiers";

export type DispatchSaleClientEmailInput = Omit<SaleClientEmailEvent, "eventType" | "email" | "userId" | "fullName" | "timestamp"> & {
    clientUserId: string | ObjectId;
};

/**
 * Resolves buyer email (username), then publishes to Kafka or sends via SMTP.
 * @returns true if an email was published/sent; false if skipped (e.g. missing buyer email).
 */
export async function dispatchSaleClientEmail(
    input: DispatchSaleClientEmailInput,
    opts?: { session?: ClientSession }
): Promise<boolean> {
    const id = typeof input.clientUserId === "string" ? input.clientUserId : input.clientUserId.toString();
    const user = await userService.findById(new ObjectId(id), {session: opts?.session}, undefined, "username name surname fullName");
    if (!user?.username) {
        return false;
    }

    const {clientUserId: _c, ...rest} = input;
    const event: SaleClientEmailEvent = {
        eventType: "sale_client_email",
        email: user.username,
        userId: user._id.toString(),
        fullName: user.fullName || `${user.name} ${user.surname}`.trim(),
        timestamp: Date.now(),
        ...rest,
    };
    await sendSaleClientMail(event);

    // if (isKafkaConnected()) {
    //     await publishSaleClientEmailEvent(event);
    // } else {
    //     await SendSaleClientEmail(event);
    // }
    return true;
}

/** Format installment due date for email copy (UTC calendar day, long form). */
export function formatInstallmentDueDateForEmail(iso: string | undefined, languageCode: string): string | undefined {
    return formatReservationExpirationForEmail(iso, languageCode);
}
