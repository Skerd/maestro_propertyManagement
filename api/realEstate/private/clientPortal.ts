/**
 * Client portal API – buyer-scoped overview / portfolio for the Pronix public profile.
 *
 * Mounted under `/api/realEstate/clientPortal`. Hard-scopes to the authenticated
 * user as sale buyer / reservation client. Does not use SchemaGuard (Web Client
 * has no panel permissions).
 *
 * **Routes:**
 * - `POST /overview` – Welcome KPIs, next payments, latest notifications.
 * - `POST /portfolio` – Portfolio KPIs + construction progress for buyer projects.
 * - `POST /properties` – Owned sales list (buyer, not rejected).
 * - `POST /reservations` – Reservations where client = userId (all statuses).
 */

import {Router} from "express";
import {ObjectId} from "mongodb";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import authMW, {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import type {EdificeBlank} from "armonia/src/modules/propertyManagement/dto/edifice.dto";
import type {ProjectSimple} from "armonia/src/modules/propertyManagement/dto/project.dto";
import type {UnitSimple} from "armonia/src/modules/propertyManagement/dto/unit.dto";
import {EdificeSnippet} from "../../../database/schemas/edifice/edifice.snippets";
import {ProjectSimpleSnippet} from "../../../database/schemas/project/project.snippets";
import {UnitSimpleSnippet} from "../../../database/schemas/unit/unit.snippets";
import {saleService} from "../../../database/schemas/sale/sale.service";
import {reservationService} from "../../../database/schemas/reservation/reservation.service";
import {ReservationStatus} from "../../../database/schemas/reservation/reservation";
import {SaleApprovalStatus} from "../../../database/schemas/sale/sale";
import {paymentPlanService} from "../../../database/schemas/paymentPlan/paymentPlan.service";
import {
    InstallmentStatus,
    PaymentPlanStatus,
} from "../../../database/schemas/paymentPlan/paymentPlan";
import {notificationService} from "@coreModule/database/schemas/notification/notification.service";
import {constructionProgressService} from "../../../database/schemas/constructionProgress/constructionProgress.service";
import {moneyNumber} from "../../../utilities/lease/rentRemaining";
import {
    clientPortalOverviewFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalOverview.form.validator";
import type {
    ClientPortalCurrencyAmount,
    ClientPortalNextPayment,
    ClientPortalOverviewFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalOverview.form.response.type";
import {
    clientPortalPortfolioFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalPortfolio.form.validator";
import type {
    ClientPortalConstructionProgressItem,
    ClientPortalPortfolioFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalPortfolio.form.response.type";
import {
    clientPortalPropertiesFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalProperties.form.validator";
import type {
    ClientPortalPropertiesFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalProperties.form.response.type";
import {
    clientPortalReservationsFormSchema,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalReservations.form.validator";
import type {
    ClientPortalReservationsFormResponseType,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/clientPortal/clientPortalReservations.form.response.type";
import {publicMediaUrl} from "@coreModule/utilities/media/publicMediaUrl";

const router = Router();
const OPEN_INSTALLMENT_STATUSES = new Set<string>([
    InstallmentStatus.PENDING,
    InstallmentStatus.OVERDUE,
    InstallmentStatus.PARTIALLY_PAID,
]);

const NON_REJECTED_SALE_FILTER = {
    $or: [
        {approvalStatus: {$exists: false}},
        {approvalStatus: null},
        {approvalStatus: {$ne: SaleApprovalStatus.REJECTED}},
    ],
};

type PopulatedRef = {_id?: unknown; name?: string};
type PopulatedUnit = {
    _id?: unknown;
    name?: string;
    netArea?: number;
    area?: number;
    mainImage?: {_id?: unknown} | ObjectId | string | null;
    project?: PopulatedRef | ObjectId;
    edifice?: PopulatedRef | ObjectId;
};

function currencyFields(currency: {_id?: unknown; symbol?: string; abbreviation?: string} | null | undefined) {
    return {
        currencySymbol: currency?.symbol ?? "€",
        currencyAbbreviation: currency?.abbreviation ?? "EUR",
    };
}

function currencyKey(currency: {_id?: unknown; symbol?: string; abbreviation?: string} | null | undefined): string {
    if (currency?._id) return String(currency._id);
    return currency?.abbreviation ?? currency?.symbol ?? "EUR";
}

function unitAreaSqm(unit: PopulatedUnit | null | undefined): number {
    if (!unit) return 0;
    if (typeof unit.netArea === "number" && !Number.isNaN(unit.netArea)) return unit.netArea;
    if (typeof unit.area === "number" && !Number.isNaN(unit.area)) return unit.area;
    return 0;
}

function refObjectId(ref: PopulatedRef | ObjectId | null | undefined): ObjectId | null {
    if (!ref) return null;
    if (ref instanceof ObjectId) return ref;
    if (typeof ref === "object" && ref._id) {
        return ref._id instanceof ObjectId ? ref._id : new ObjectId(String(ref._id));
    }
    return null;
}

function collectProjectIds(units: Array<PopulatedUnit | null | undefined>): ObjectId[] {
    const ids = new Map<string, ObjectId>();
    for (const unit of units) {
        const projectId = refObjectId(unit?.project);
        if (projectId) ids.set(projectId.toString(), projectId);
    }
    return Array.from(ids.values());
}

router.post(
    "/overview",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(clientPortalOverviewFormSchema),
    asyncHandler(clientPortalOverview),
);

router.post(
    "/portfolio",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(clientPortalPortfolioFormSchema),
    asyncHandler(clientPortalPortfolio),
);

router.post(
    "/properties",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(clientPortalPropertiesFormSchema),
    asyncHandler(clientPortalProperties),
);

router.post(
    "/reservations",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(clientPortalReservationsFormSchema),
    asyncHandler(clientPortalReservations),
);

async function clientPortalOverview(
    params: AuthenticatedMWType,
): Promise<ClientPortalOverviewFormResponseType> {
    const {company, actionUserCtx, logger, languageCode} = params;
    const userId = new ObjectId(actionUserCtx.userId);
    const companyId = company._id;

    logger.start(`Client portal overview for user ${actionUserCtx.userId}`);

    const sales = await saleService.find(
        {
            company: companyId,
            buyer: userId,
            ...NON_REJECTED_SALE_FILTER,
        },
        {logger, languageCode},
        [
            {path: "saleCurrency", select: "symbol abbreviation"},
            {path: "paymentPlan", select: "_id"},
            {path: "unit", select: "netArea area"},
        ],
        "finalPrice saleCurrency paymentPlan name unit",
    );

    const activeReservations = await reservationService.find(
        {
            company: companyId,
            client: userId,
            status: ReservationStatus.ACTIVE,
        },
        {logger, languageCode},
        undefined,
        "_id",
    );

    const portfolioByCurrency = new Map<string, ClientPortalCurrencyAmount>();
    let totalAreaSqm = 0;
    for (const sale of sales) {
        const currency = sale.saleCurrency as {_id?: unknown; symbol?: string; abbreviation?: string} | undefined;
        const key = currencyKey(currency);
        const amount = moneyNumber(sale.finalPrice);
        const existing = portfolioByCurrency.get(key);
        if (existing) {
            existing.amount += amount;
        } else {
            portfolioByCurrency.set(key, {
                amount,
                ...currencyFields(currency),
            });
        }
        totalAreaSqm += unitAreaSqm(sale.unit as PopulatedUnit | undefined);
    }

    const salesById = new Map(sales.map((sale) => [sale._id.toString(), sale]));

    const planIds = sales
        .map((sale) => {
            const plan = sale.paymentPlan as {_id?: ObjectId} | ObjectId | null | undefined;
            if (!plan) return null;
            if (plan instanceof ObjectId) return plan;
            return plan._id ?? null;
        })
        .filter((id): id is ObjectId => !!id);

    const nextPayments: ClientPortalNextPayment[] = [];
    if (planIds.length > 0) {
        const plans = await paymentPlanService.find(
            {
                company: companyId,
                _id: {$in: planIds},
                status: PaymentPlanStatus.ACTIVE,
            },
            {logger, languageCode},
        );

        for (const plan of plans) {
            const saleId =
                plan.sale instanceof ObjectId
                    ? plan.sale.toString()
                    : (plan.sale as {_id?: ObjectId} | null | undefined)?._id?.toString() ?? String(plan.sale);
            const sale = salesById.get(saleId);
            const currency = currencyFields(
                sale?.saleCurrency as {_id?: unknown; symbol?: string; abbreviation?: string} | undefined,
            );

            if (!plan.downPaymentPaid) {
                const downAmount = moneyNumber(plan.downPayment);
                nextPayments.push({
                    kind: "down_payment",
                    dueDate: (plan.startDate ?? new Date()).toISOString(),
                    amount: downAmount,
                    remaining: downAmount,
                    ...currency,
                    saleName: sale?.name,
                    status: "pending",
                });
            }

            for (const installment of plan.installments ?? []) {
                if (!OPEN_INSTALLMENT_STATUSES.has(installment.status)) continue;
                const amount = moneyNumber(installment.amount);
                const paidAmount = moneyNumber(installment.paidAmount);
                nextPayments.push({
                    kind: "installment",
                    dueDate: installment.dueDate.toISOString(),
                    amount,
                    remaining: Math.max(0, amount - paidAmount),
                    ...currency,
                    saleName: sale?.name,
                    installmentNumber: installment.installmentNumber,
                    status: installment.status,
                });
            }
        }
    }

    nextPayments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const cappedPayments = nextPayments.slice(0, 3);

    const [latestNotifications, unreadNotifications] = await Promise.all([
        notificationService.find(
            {receiver: userId, company: companyId},
            {logger, languageCode},
            undefined,
            "code description date readOn",
            {date: -1},
            5,
            0,
        ),
        notificationService.count(
            {
                receiver: userId,
                company: companyId,
                readOn: {$in: [null, undefined]},
            },
            {logger, languageCode},
        ),
    ]);

    logger.finish(`Client portal overview for user ${actionUserCtx.userId}`);

    return {
        propertiesOwned: sales.length,
        activeReservations: activeReservations.length,
        totalAreaSqm,
        portfolioValue: Array.from(portfolioByCurrency.values()),
        nextPayments: cappedPayments,
        unreadNotifications,
        latestNotifications: latestNotifications.map((notification) => ({
            _id: notification._id.toString(),
            code: notification.code,
            description: notification.description ?? "",
            date: notification.date.toISOString(),
            ...(notification.readOn ? {readOn: notification.readOn.toISOString()} : {}),
        })),
    };
}

async function clientPortalPortfolio(
    params: AuthenticatedMWType,
): Promise<ClientPortalPortfolioFormResponseType> {
    const {company, actionUserCtx, logger, languageCode} = params;
    const userId = new ObjectId(actionUserCtx.userId);
    const companyId = company._id;

    logger.start(`Client portal portfolio for user ${actionUserCtx.userId}`);

    const [sales, activeReservations] = await Promise.all([
        saleService.find(
            {
                company: companyId,
                buyer: userId,
                ...NON_REJECTED_SALE_FILTER,
            },
            {logger, languageCode},
            [
                {path: "saleCurrency", select: "symbol abbreviation"},
                {path: "unit", select: "netArea area project"},
            ],
            "finalPrice saleCurrency unit",
        ),
        reservationService.find(
            {
                company: companyId,
                client: userId,
                status: ReservationStatus.ACTIVE,
            },
            {logger, languageCode},
            [{path: "unit", select: "project"}],
            "_id unit",
        ),
    ]);

    const portfolioByCurrency = new Map<string, ClientPortalCurrencyAmount>();
    let totalAreaSqm = 0;
    for (const sale of sales) {
        const currency = sale.saleCurrency as {_id?: unknown; symbol?: string; abbreviation?: string} | undefined;
        const key = currencyKey(currency);
        const amount = moneyNumber(sale.finalPrice);
        const existing = portfolioByCurrency.get(key);
        if (existing) {
            existing.amount += amount;
        } else {
            portfolioByCurrency.set(key, {
                amount,
                ...currencyFields(currency),
            });
        }
        totalAreaSqm += unitAreaSqm(sale.unit as PopulatedUnit | undefined);
    }

    const projectIds = collectProjectIds([
        ...sales.map((sale) => sale.unit as PopulatedUnit | undefined),
        ...activeReservations.map((reservation) => reservation.unit as PopulatedUnit | undefined),
    ]);

    let constructionProgress: ClientPortalConstructionProgressItem[] = [];
    if (projectIds.length > 0) {
        const rows = await constructionProgressService.find(
            {
                company: companyId,
                project: {$in: projectIds},
            },
            {logger, languageCode},
            [
                {path: "project", select: "name"},
                {path: "edifice", select: "name"},
            ],
            "project edifice phase progressPercent title updateDate",
            {updateDate: -1},
        );

        constructionProgress = rows.map((row) => {
            const project = mapSnippet<ProjectSimple>()(row.project as object | undefined, ProjectSimpleSnippet);
            const edifice = mapSnippet<EdificeBlank>()(row.edifice as object | undefined, EdificeSnippet);
            return {
                _id: row._id.toString(),
                projectName: project?.name ?? "",
                ...(edifice?.name ? {edificeName: edifice.name} : {}),
                phase: row.phase,
                progressPercent: row.progressPercent,
                title: row.title,
                updateDate: row.updateDate.toISOString(),
            };
        });
    }

    logger.finish(`Client portal portfolio for user ${actionUserCtx.userId}`);

    return {
        portfolioValue: Array.from(portfolioByCurrency.values()),
        totalAreaSqm,
        activeReservations: activeReservations.length,
        constructionProgress,
    };
}

async function clientPortalProperties(
    params: AuthenticatedMWType,
): Promise<ClientPortalPropertiesFormResponseType> {
    const {company, actionUserCtx, logger, languageCode} = params;
    const userId = new ObjectId(actionUserCtx.userId);
    const companyId = company._id;

    logger.start(`Client portal properties for user ${actionUserCtx.userId}`);

    const sales = await saleService.find(
        {
            company: companyId,
            buyer: userId,
            ...NON_REJECTED_SALE_FILTER,
        },
        {logger, languageCode},
        [
            {path: "saleCurrency", select: "symbol abbreviation"},
            {
                path: "unit",
                select: "name netArea area mainImage project edifice",
                populate: [
                    {path: "project", select: "name"},
                    {path: "edifice", select: "name"},
                    {path: "mainImage", select: "_id"},
                ],
            },
        ],
        "finalPrice saleCurrency unit name",
        {saleDate: -1},
    );

    const properties = sales.map((sale) => {
        const unit = sale.unit as PopulatedUnit | undefined;
        const project = mapSnippet<ProjectSimple>()(unit?.project as object | undefined, ProjectSimpleSnippet);
        const edifice = mapSnippet<EdificeBlank>()(unit?.edifice as object | undefined, EdificeSnippet);
        const unitRef = mapSnippet<UnitSimple>()(unit as object | undefined, UnitSimpleSnippet);
        const currency = currencyFields(
            sale.saleCurrency as {_id?: unknown; symbol?: string; abbreviation?: string} | undefined,
        );
        const area = unitAreaSqm(unit);
        const imageUrl = publicMediaUrl(unit?.mainImage);

        return {
            _id: sale._id.toString(),
            saleId: sale._id.toString(),
            unitId: unitRef?._id ?? "",
            unitName: unitRef?.name || sale.name || "",
            ...(project?._id ? {projectId: project._id} : {}),
            ...(project?.name ? {projectName: project.name} : {}),
            ...(edifice?.name ? {edificeName: edifice.name} : {}),
            ...(imageUrl ? {imageUrl} : {}),
            ...(area > 0 ? {areaSqm: area} : {}),
            price: moneyNumber(sale.finalPrice),
            ...currency,
        };
    });

    logger.finish(`Client portal properties for user ${actionUserCtx.userId}`);

    return {properties};
}

async function clientPortalReservations(
    params: AuthenticatedMWType,
): Promise<ClientPortalReservationsFormResponseType> {
    const {company, actionUserCtx, logger, languageCode} = params;
    const userId = new ObjectId(actionUserCtx.userId);
    const companyId = company._id;

    logger.start(`Client portal reservations for user ${actionUserCtx.userId}`);

    const reservations = await reservationService.find(
        {
            company: companyId,
            client: userId,
        },
        {logger, languageCode},
        [
            {
                path: "unit",
                select: "name project edifice",
                populate: [
                    {path: "project", select: "name"},
                    {path: "edifice", select: "name"},
                ],
            },
            {path: "depositCurrency", select: "symbol abbreviation"},
        ],
        "name status unit reservationDate expirationDate depositAmount depositCurrency",
        {reservationDate: -1},
    );

    const items = reservations.map((reservation) => {
        const unit = reservation.unit as PopulatedUnit | undefined;
        const project = mapSnippet<ProjectSimple>()(unit?.project as object | undefined, ProjectSimpleSnippet);
        const edifice = mapSnippet<EdificeBlank>()(unit?.edifice as object | undefined, EdificeSnippet);
        const unitRef = mapSnippet<UnitSimple>()(unit as object | undefined, UnitSimpleSnippet);
        const deposit = reservation.depositAmount != null
            ? moneyNumber(reservation.depositAmount)
            : undefined;
        const currency = reservation.depositCurrency
            ? currencyFields(
                reservation.depositCurrency as {_id?: unknown; symbol?: string; abbreviation?: string},
            )
            : undefined;

        return {
            _id: reservation._id.toString(),
            ...(reservation.name ? {name: reservation.name} : {}),
            status: reservation.status ?? (reservation.isActive ? ReservationStatus.ACTIVE : ReservationStatus.CANCELLED),
            ...(unitRef?.name ? {unitName: unitRef.name} : {}),
            ...(project?.name ? {projectName: project.name} : {}),
            ...(edifice?.name ? {edificeName: edifice.name} : {}),
            reservationDate: reservation.reservationDate.toISOString(),
            expirationDate: reservation.expirationDate.toISOString(),
            ...(deposit != null ? {depositAmount: deposit} : {}),
            ...(currency ? currency : {}),
        };
    });

    logger.finish(`Client portal reservations for user ${actionUserCtx.userId}`);

    return {reservations: items};
}

export const basePath = "/api/realEstate/clientPortal";
export {router};
