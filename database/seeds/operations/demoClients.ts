import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import type {ICompany} from "@coreModule/database/schemas/company/company";
import {createDemoSignupUsers, type DemoSignupUserSeed} from "@coreModule/database/demo/demoSignupUsers";

/** Shared demo password. Hashed on save by the User pre-save hook. */
export const PM_DEMO_CLIENT_PASSWORD = "estates";

export type PmDemoClientSeed = DemoSignupUserSeed;

/** The buyers, reservation clients and tenants the sale, reservation and lease seeds name (TD-B206). */
export const pmDemoClientSeeds: readonly PmDemoClientSeed[] = [
    {username: "elira.daka@example.com", name: "Elira", surname: "Daka", phoneNumber: "+355691120101", birthday: "1987-04-09"},
    {username: "marco.bianchi@example.com", name: "Marco", surname: "Bianchi", phoneNumber: "+41791120102", birthday: "1979-10-22"},
    {username: "sofia.keller@example.com", name: "Sofia", surname: "Keller", phoneNumber: "+41791120103", birthday: "1992-02-17"},
];

/**
 * Creates the demo clients as members of the company with its signup role (Web Client), through core's
 * `createDemoSignupUsers`. Idempotent on username. Runs before the commercial seeds, which look the clients up by username.
 */
export async function createDemoClients(parentLogger: serverLogger | undefined, company: Pick<ICompany, "_id" | "name" | "createdBy" | "timezone">): Promise<void> {
    const logger = getLogger("propertyManagement_demo_clients", parentLogger);
    logger.start(`Creating demo clients for '${company.name}'...`);
    await createDemoSignupUsers(logger, company, pmDemoClientSeeds, PM_DEMO_CLIENT_PASSWORD);
    logger.finish(`Finished demo clients for '${company.name}'`);
}
