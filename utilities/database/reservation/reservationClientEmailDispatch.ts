import type {ClientSession} from "mongodb";
import {ObjectId} from "mongodb";
import {isKafkaConnected} from "@coreModule/connections/connectToKafka";
import {userService} from "@coreModule/database/schemas/user/user.service";
import type {ReservationClientEmailEvent} from "../../../kafka/types";
import {publishReservationClientEmailEvent} from "../../../kafka/kafkaProducer";
import {sendReservationClientMail} from "@propertyManagement/utilities/emails/notifiers";

export type DispatchReservationClientEmailInput = Omit<ReservationClientEmailEvent, "eventType" | "email" | "userId" | "fullName" | "timestamp"> & {
    clientUserId: string | ObjectId;
};

/**
 * Loads client user (email = username), then publishes to Kafka or sends via SMTP (same split as User activation / invitation).
 * @returns true if an email was published/sent; false if skipped (e.g. missing client email).
 */
export async function dispatchReservationClientEmail(input: DispatchReservationClientEmailInput, opts?: { session?: ClientSession }): Promise<boolean> {

    const id = typeof input.clientUserId === "string" ? input.clientUserId : input.clientUserId.toString();
    const user = await userService.findById(new ObjectId(id), {session: opts?.session}, undefined, "username name surname fullName");
    if (!user?.username) {
        return false;
    }

    const {clientUserId: _c, ...rest} = input;
    const event: ReservationClientEmailEvent = {
        eventType: "reservation_client_email",
        email: user.username,
        userId: user._id.toString(),
        fullName: user.fullName || `${user.name} ${user.surname}`.trim(),
        timestamp: Date.now(),
        ...rest,
    };

    if (isKafkaConnected()) {
        await publishReservationClientEmailEvent(event);
    } else {
        await sendReservationClientMail(event);
    }
    return true;
}

export function formatReservationExpirationForEmail(iso: string | undefined, languageCode: string): string | undefined {
    if (!iso) {
        return undefined;
    }
    try {
        return new Date(iso).toLocaleDateString(languageCode, {dateStyle: "long", timeZone: "UTC"});
    } catch {
        return undefined;
    }
}
