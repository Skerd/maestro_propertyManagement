import {ObjectId} from "mongodb";
import User from "@coreModule/database/schemas/user/user";
import Role from "@coreModule/database/schemas/role/role";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import type {ICompany} from "@coreModule/database/schemas/company/company";
import {companyTimeZone} from "@coreModule/utilities/time/companyTimeZone";

/** Shared demo password. Hashed on save by the User pre-save hook. */
export const PM_DEMO_CLIENT_PASSWORD = "estates";

export type PmDemoClientSeed = {
    username: string;
    name: string;
    surname: string;
    phoneNumber: string;
    birthday: string;
};

/** The buyers, reservation clients and tenants the sale, reservation and lease seeds name (TD-B206). */
export const pmDemoClientSeeds: readonly PmDemoClientSeed[] = [
    {username: "elira.daka@example.com", name: "Elira", surname: "Daka", phoneNumber: "+355691120101", birthday: "1987-04-09"},
    {username: "marco.bianchi@example.com", name: "Marco", surname: "Bianchi", phoneNumber: "+41791120102", birthday: "1979-10-22"},
    {username: "sofia.keller@example.com", name: "Sofia", surname: "Keller", phoneNumber: "+41791120103", birthday: "1992-02-17"},
];

function refId(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (value instanceof ObjectId) return value.toString();
    if (typeof value === "object" && "_id" in value) {
        const inner = (value as {_id?: unknown})._id;
        if (inner != null && inner !== value) return refId(inner);
    }
    return String(value);
}

/**
 * Creates the demo clients as members of the company with its signup role (Web Client): customers, not staff, so
 * they stay off the staff pickers. A client who already belongs to the company keeps their roles. Idempotent on
 * username. Runs before the commercial seeds, which look the clients up by username.
 */
export async function createDemoClients(parentLogger: serverLogger | undefined, company: Pick<ICompany, "_id" | "name" | "createdBy" | "timezone">): Promise<void> {
    const logger = getLogger("propertyManagement_demo_clients", parentLogger);
    logger.start(`Creating demo clients for '${company.name}'...`);
    const companyId = company._id as ObjectId;
    const creatorId = refId(company.createdBy);

    const role = await Role.findOne({company: companyId, isSignupDefault: true}).select("_id name");
    if (!role) {
        logger.warn(`'${company.name}' has no signup role; skipping the demo clients`);
        return;
    }

    for (const seed of pmDemoClientSeeds) {
        const membership = {
            _id: new ObjectId(),
            active: "active" as const,
            unsuccessfulLogins: 0,
            lockedOutUntil: null,
            lastLogin: null,
            rolesCount: 1,
            roles: [role._id],
            company: companyId,
        };
        const user = await User.findOne({username: seed.username});
        if (user) {
            if (user.roles.some((entry) => refId(entry.company) === companyId.toString())) {
                logger.info(`${seed.username} already belongs to '${company.name}'`);
                continue;
            }
            if (!user.companies.some((entry) => refId(entry) === companyId.toString())) user.companies.push(companyId as never);
            user.roles.push(membership);
            user.$locals = user.$locals || {};
            user.$locals.auditUserId = creatorId ? new ObjectId(creatorId) : user._id;
            await user.save();
            logger.info(`Added ${seed.username} to '${company.name}' as '${role.name}'`);
            continue;
        }

        const userId = new ObjectId();
        const created = new User({
            _id: userId,
            username: seed.username,
            password: PM_DEMO_CLIENT_PASSWORD,
            name: seed.name,
            surname: seed.surname,
            fullName: `${seed.name} ${seed.surname}`,
            timezone: companyTimeZone(company),
            birthday: seed.birthday,
            phoneNumber: seed.phoneNumber,
            isEmailVerified: true,
            registeredFrom: creatorId ? new ObjectId(creatorId) : userId,
            mfaStatus: "notActive",
            online: false,
            isBot: false,
            companies: [companyId],
            roles: [membership],
        });
        created.$locals = created.$locals || {};
        created.$locals.auditUserId = creatorId ? new ObjectId(creatorId) : userId;
        await created.save();
        logger.info(`Created ${seed.username} as '${role.name}'`);
    }

    logger.finish(`Finished demo clients for '${company.name}'`);
}
