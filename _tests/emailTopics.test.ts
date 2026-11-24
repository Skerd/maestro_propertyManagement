/**
 * D188: the rent, website inquiry, staff alert and construction update emails each go through their kind's own Kafka
 * topic, and are sent directly when the publish fails; a construction update's photos travel as ids.
 */
import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const {published, publishResult, sent, specs, photoLoads} = vi.hoisted(() => ({
    published: [] as {topic: string | undefined; key: string; event: {eventType: string}}[],
    publishResult: {value: true},
    sent: [] as {mail: string; data: Record<string, unknown>}[],
    specs: [] as {topic?: string; groupId?: string; expectedEventType: string}[],
    photoLoads: [] as unknown[][],
}));

vi.mock("@propertyManagement/environment", async (importOriginal) => {
    const {PROPERTY_MANAGEMENT_KAFKA} = await importOriginal<typeof import("@propertyManagement/environment")>();
    const keys = Object.keys(PROPERTY_MANAGEMENT_KAFKA.TOPICS);
    return {
        PROPERTY_MANAGEMENT_KAFKA: {
            TOPICS: Object.fromEntries(keys.map((key) => [key, `topic-${key}`])),
            CONSUMER_GROUP: Object.fromEntries(keys.map((key) => [key, `group-${key}`])),
        },
    };
});
vi.mock("@coreModule/environment", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@coreModule/environment")>();
    return {...actual, KAFKA: {...actual.KAFKA, ENABLED: true}};
});
vi.mock("@coreModule/kafka/kafkaProducer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@coreModule/kafka/kafkaProducer")>()),
    publishEvent: vi.fn(async (topic: string | undefined, key: string, event: {eventType: string}) => {
        published.push({topic, key, event});
        return publishResult.value;
    }),
}));
vi.mock("@coreModule/kafka/kafkaConsumer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@coreModule/kafka/kafkaConsumer")>()),
    addKafkaTopicConsumer: vi.fn(async (_parent: unknown, spec: (typeof specs)[number]) => {
        specs.push(spec);
    }),
    startKafkaTopicConsumers: vi.fn(async (_parent: unknown, _log: unknown, given: typeof specs) => {
        specs.push(...given);
    }),
}));
vi.mock("@coreModule/database/schemas/user/user.service", () => ({
    userService: {findById: vi.fn(async (id: ObjectId) => ({_id: id, username: "tenant@example.com", fullName: "Tia Tenant"}))},
}));
vi.mock("@propertyManagement/utilities/emails/leaseNotifiers", () => ({
    sendLeaseClientMail: vi.fn(async (data: Record<string, unknown>) => {
        sent.push({mail: "lease", data});
    }),
}));
vi.mock("@propertyManagement/utilities/emails/inquiryNotifiers", () => ({
    sendInquiryClientMail: vi.fn(async (data: Record<string, unknown>) => {
        sent.push({mail: "inquiry", data});
    }),
}));
vi.mock("@propertyManagement/utilities/emails/staffAlertNotifiers", () => ({
    sendSalesStaffAlertMail: vi.fn(async (data: Record<string, unknown>) => {
        sent.push({mail: "staff", data});
    }),
}));
vi.mock("@propertyManagement/utilities/emails/constructionProgressNotifiers", () => ({
    sendConstructionProgressClientMail: vi.fn(async (data: Record<string, unknown>) => {
        sent.push({mail: "construction", data});
    }),
}));
vi.mock("@propertyManagement/utilities/emails/mediaImageAttachments", () => ({
    loadInlineImageAttachments: vi.fn(async (ids: unknown[]) => {
        photoLoads.push(ids);
        return ids.map((id) => ({filename: `${String(id)}.jpg`, content: Buffer.from("jpg"), contentType: "image/jpeg", cid: String(id)}));
    }),
}));

import {dispatchLeaseClientEmail} from "@propertyManagement/utilities/database/lease/leaseClientEmailDispatch";
import {
    dispatchConstructionProgressClientEmail,
    dispatchInquiryClientEmail,
    dispatchSalesStaffAlertEmail,
    sendConstructionProgressClientEmailEvent,
} from "@propertyManagement/utilities/emails/emailDispatch";
import {loadInlineImageAttachments} from "@propertyManagement/utilities/emails/mediaImageAttachments";
import {startRealEstateKafkaConsumers} from "@propertyManagement/kafka/kafkaConsumer";
import type {ConstructionProgressClientEmailEvent} from "@propertyManagement/kafka/types";

const company = {companyId: "c1", companyName: "Vista", languageCode: "en-US"};
const lease = (kind: "rent_reminder" | "rent_remaining_days" | "rent_overdue") =>
    ({...company, kind, leaseId: "l1", clientUserId: new ObjectId()});
const staffBase = {...company, email: "watcher@vista.test", fullName: "Walt Watcher"};
const progress: ConstructionProgressClientEmailEvent = {
    eventType: "construction_progress_client_email",
    timestamp: Date.now(),
    constructionProgressId: "p1",
    photoIds: ["m1", "m2"],
    ...company,
    email: "buyer@example.com",
    fullName: "Bea Buyer",
    projectName: "Vista Park",
    unitLabels: ["A-1"],
    phase: "structure",
    progressPercent: 40,
};

beforeEach(() => {
    published.length = 0;
    sent.length = 0;
    specs.length = 0;
    photoLoads.length = 0;
    publishResult.value = true;
});

describe("property management emails on Kafka (D188)", () => {
    it("publishes each kind on its own topic, keyed by its record, and sends nothing directly", async () => {
        for (const kind of ["rent_reminder", "rent_remaining_days", "rent_overdue"] as const) await dispatchLeaseClientEmail(lease(kind));
        await dispatchInquiryClientEmail({...company, email: "visitor@example.com", fullName: "Vic Visitor", projectName: "Vista Park", accountUrl: "https://portal.example/account"});
        await dispatchSalesStaffAlertEmail({...staffBase, kind: "sale_created", saleId: "s1", pendingApproval: false, paymentType: "cash"});
        await dispatchSalesStaffAlertEmail({...staffBase, kind: "reservation_created", reservationId: "r1"});
        await dispatchSalesStaffAlertEmail({...staffBase, kind: "reservation_expired", reservationId: "r2"});
        await dispatchConstructionProgressClientEmail(progress, () => loadInlineImageAttachments(progress.photoIds, {languageCode: "en-US"}));

        const keys = ["RENT_REMINDER_EMAIL", "RENT_REMAINING_DAYS_EMAIL", "RENT_OVERDUE_EMAIL", "INQUIRY_CLIENT_EMAIL", "SALE_CREATED_STAFF_EMAIL",
            "RESERVATION_CREATED_STAFF_EMAIL", "RESERVATION_EXPIRED_STAFF_EMAIL", "CONSTRUCTION_PROGRESS_CLIENT_EMAIL"];
        expect(published.map((p) => p.topic)).toEqual(keys.map((key) => `topic-${key}`));
        expect(published.map((p) => p.event.eventType)).toEqual(keys.map((key) => key.toLowerCase()));
        expect(published.map((p) => p.key)).toEqual(["l1", "l1", "l1", "visitor@example.com", "s1", "r1", "r2", "p1"]);
        expect(sent).toEqual([]);
        // Published: the photos stay in GridFS until the consumer loads them.
        expect(photoLoads).toEqual([]);
    });

    it("sends it directly when it is not published, loading a construction update's photos once for every client", async () => {
        publishResult.value = false;
        await dispatchLeaseClientEmail(lease("rent_overdue"));
        await dispatchSalesStaffAlertEmail({...staffBase, kind: "reservation_expired", reservationId: "r2"});
        let loaded: ReturnType<typeof loadInlineImageAttachments> | undefined;
        const photos = () => (loaded ??= loadInlineImageAttachments(progress.photoIds, {languageCode: "en-US"}));
        await dispatchConstructionProgressClientEmail(progress, photos);
        await dispatchConstructionProgressClientEmail({...progress, email: "other@example.com"}, photos);

        expect(sent.map((s) => s.mail)).toEqual(["lease", "staff", "construction", "construction"]);
        expect(sent[0].data).toMatchObject({email: "tenant@example.com", kind: "rent_overdue", eventType: "rent_overdue_email"});
        expect(photoLoads).toEqual([["m1", "m2"]]);
        expect((sent[2].data.photos as {cid: string}[]).map((photo) => photo.cid)).toEqual(["m1", "m2"]);
    });

    it("loads a construction update's photos by id when the consumer sends it", async () => {
        await sendConstructionProgressClientEmailEvent(progress);

        expect(photoLoads).toEqual([["m1", "m2"]]);
        expect(sent[0].data).toMatchObject({email: "buyer@example.com", photos: [{cid: "m1"}, {cid: "m2"}]});
    });

    it("starts the reservation and sale consumers plus one consumer per newer kind", async () => {
        await startRealEstateKafkaConsumers();

        expect(specs).toHaveLength(10);
        expect(new Set(specs.map((spec) => spec.topic)).size).toBe(10);
        expect(specs.slice(2).map((spec) => spec.expectedEventType)).toEqual([
            "rent_reminder_email", "rent_remaining_days_email", "rent_overdue_email", "inquiry_client_email",
            "sale_created_staff_email", "reservation_created_staff_email", "reservation_expired_staff_email", "construction_progress_client_email",
        ]);
    });
});
