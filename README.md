# Property Management Module (Maestro)

Server-side implementation of real-estate and property-management operations: projects, buildings, units, reservations, sales, payment plans, leasing, construction progress, marketing campaigns and reporting.

Contracts live in **armonia** at `armonia/src/modules/propertyManagement/`. This module implements persistence, routes, domain logic, notifications, cron handlers and the client-email Kafka consumers.

Enable via `ENABLED_MODULES=propertyManagement`.

## Directory layout

```
propertyManagement/
├── api/realEstate/
│   ├── private/                   # Panel routes (authMW("private")); unit/ holds unit-child resources
│   └── public/                    # Public site + login-less routes (company resolved by origin, or by token)
├── database/
│   ├── moduleBootstrap.ts         # Registered models, default roles, ref selects
│   ├── companyDemoSeed.ts, demo/, seeds/
│   └── schemas/<resource>/        # schema, service, actions, views, indexes, snippets, defaults
├── domain/
│   ├── ai/tools/                  # Assistant tools (panel + public chat)
│   ├── notifications/             # Notification codes + handlers
│   ├── portal/                    # Core portal provider (properties)
│   └── publicChat/                # Lead capture from the public chat
├── kafka/                         # Client-email producers/consumers
├── websocket/roomContribution.ts  # Room display names
└── utilities/
    ├── cron/registerHandlers.ts   # Cron handler registration
    ├── cronJobs/                  # The jobs those handlers run
    ├── database/                  # Client-email dispatch (reservation, sale, lease)
    ├── emails/                    # Email templates + locales (5 locales)
    ├── erasure/                   # Person eraser (SEC-06)
    ├── edifice/floorAndUnitsGenerator/  # Floor/unit generation (OpenCV-assisted)
    └── …                          # hubs, contractsHub, paymentsHub, rentalsHub, pdf, marketing, mappers, …
```

## API routes

Route files are discovered by the core `routeRegistry`: a file under `api/` mounts at `/api/<path>` with `private/` and `public/` dropped (e.g. `private/lease.ts` → `/api/realEstate/lease`), unless it exports its own `basePath`. CRUD files use `createCrudRouter` (the seven verbs plus their `@action`s as `POST /<method>`); the others are hand-written routers.

### Private — portfolio structure (CRUD)

| Route file | Mounted at | Description |
|------------|------------|-------------|
| `project.ts` | `/api/realEstate/project` | Development projects |
| `edifice.ts` | `/api/realEstate/edifice` | Buildings |
| `floor.ts` | `/api/realEstate/floor` | Floors |
| `unit/unit.ts` | `/api/realEstate/unit` | Units; plus `PATCH /bulk/updatePrice`, `PATCH /bulk/updateStatus`, `POST /availability` |
| `unit/cost.ts` | `/api/realEstate/unit/cost` | Unit costs |
| `unit/inspection.ts` | `/api/realEstate/unit/inspection` | Inspections |
| `unit/modificationRequest.ts` | `/api/realEstate/unit/modificationRequest` | Modification requests |
| `unitType.ts` / `unitTypeCategory.ts` | `/api/realEstate/unitType`, `/api/realEstate/unitTypeCategory` | Unit typologies |
| `constructor.ts` | `/api/realEstate/constructor` | Construction companies |
| `constructionProgress.ts` | `/api/realEstate/constructionProgress` | Construction progress reports (phase, %, photos; notifies unit clients) |
| `inspectionChecklistTemplate.ts` | `/api/realEstate/inspectionChecklistTemplate` | Inspection checklist templates |
| `handoverPackage.ts` | `/api/realEstate/handoverPackage` | Handover packages |
| `story.ts` / `storyType.ts` | `/api/realEstate/story`, `/api/realEstate/storyType` | Marketing stories and their types |

### Private — sales, leasing, marketing (CRUD)

| Route file | Mounted at | Description |
|------------|------------|-------------|
| `unit/reservation.ts` | `/api/realEstate/unit/reservation` | Reservations (create + lifecycle actions) |
| `unit/sale.ts` | `/api/realEstate/unit/sale` | Sales; plus `POST /paymentPlan/single`, `POST /paymentPlan/pdf` |
| `commission.ts` | `/api/realEstate/commission` | Agent commissions |
| `lead.ts` | `/api/realEstate/lead` | Sales leads |
| `lease.ts` | `/api/realEstate/lease` | Rental agreements |
| `rentalPayment.ts` | `/api/realEstate/rentalPayment` | Rent payments |
| `adCampaign.ts` | `/api/realEstate/adCampaign` | Marketing email campaigns |
| `adCampaignRecipient.ts` | `/api/realEstate/adCampaignRecipient` | Campaign recipients (read-only in practice) |
| `adCampaignTemplate.ts` | `/api/realEstate/adCampaignTemplate` | Editable campaign templates |
| `marketingPreference.ts` | `/api/realEstate/marketingPreference` | Marketing consent rows; `me`/`updateMe` self-service actions |
| `propertyManagementConfig.ts` | `/api/realEstate/propertyManagementConfig` | Company settings (incl. `notifyOnSales` / `notifyOnReservations` watchers) |

### Private — hubs and reporting (hand-written routers)

| Route file | Mounted at | Endpoints |
|------------|------------|-----------|
| `dashboard.ts` | `/api/realEstate/dashboard` | KPI dashboard (canonical SchemaGuard-filtered custom router) |
| `groupDashboard.ts` | `/api/realEstate/groupDashboard` | KPIs per branch company + group total |
| `paymentsHub.ts` | `/api/realEstate/paymentsHub` | `/payments/list`, `/payments/calendar`, `/payments/summary` (down payments + installments) |
| `rentalsHub.ts` | `/api/realEstate/rentalsHub` | `/leases/list`, `/rentalPayments/list`, `/rentalPayments/calendar` |
| `contractsHub.ts` | `/api/realEstate/contractsHub` | `/contracts/list`, `/clients/list` |
| `agentReport.ts` | `/api/realEstate/agentReport` | Per-agent sales report |
| `roi.ts` | `/api/realEstate/roi` | Unit costs vs sale prices and rent, per scope |
| `erpExport.ts` | `/api/realEstate/erpExport` | ERP export |
| `clientPortal.ts` | `/api/realEstate/clientPortal` | `/overview`, `/portfolio`, `/properties`, `/reservations`: buyer-scoped views for the signed-in client |

### Public

| Route file | Mounted at | Description |
|------------|------------|-------------|
| `marketingCompany.ts` | `/api/realEstate/marketingCompany` | Company profile for the public site |
| `marketingProjects.ts` / `marketingProject.ts` | `/api/realEstate/marketingProjects`, `/api/realEstate/marketingProject/single` | Project list / one project |
| `marketingProjectsCatalog.ts` / `marketingProjectCatalog.ts` | `/api/realEstate/marketingProjectsCatalog`, `/api/realEstate/marketingProjectCatalog/single` | Catalog views |
| `marketingFeaturedProjects.ts` / `marketingFeaturedUnits.ts` | `/api/realEstate/marketingFeaturedProjects`, `/api/realEstate/marketingFeaturedUnits` | Featured items |
| `marketingUnit.ts` | `/api/realEstate/marketingUnit` | `/single`, `/brochure` |
| `marketingAvailability.ts` | `/api/realEstate/marketingAvailability` | Unit availability |
| `marketingStats.ts` | `/api/realEstate/marketingStats` | Public counters |
| `marketingStories.ts` | `/api/realEstate/marketingStories` | Stories list + `/single` |
| `marketingContact.ts` | `/api/realEstate/marketingContact` | Contact form (creates a `Lead`) |
| `publicChatIdentify.ts` | `/api/realEstate/publicChat` | `/identify`: public-chat visitor details → `Lead` |
| `adCampaignUnsubscribe.ts` | `/api/realEstate/adCampaignUnsubscribe` | Login-less preferences + one-click unsubscribe; the token (not the origin) gives the company |

## Database models

Registered in `database/moduleBootstrap.ts` (`propertyManagementModels`):

`Project`, `Edifice`, `Floor`, `Unit`, `ConstructionProgress`, `UnitCost`, `UnitType`, `UnitTypeCategory`, `Constructor`, `Inspection`, `ModificationRequest`, `Reservation`, `Sale`, `PaymentPlan`, `Commission`, `Lead`, `StoryType`, `Story`, `Lease`, `RentalPayment`, `HandoverPackage`, `InspectionChecklistTemplate`, `PropertyManagementConfig`, `DashboardCache`, `AdCampaignTemplate`, `AdCampaign`, `AdCampaignRecipient`, `MarketingPreference`

The bootstrap also registers the module's default roles (`realEstate.role.defaults.ts`) and ref selects.

## Cron handlers

Registered by `registerPropertyManagementCronHandlers` (`utilities/cron/registerHandlers.ts`). Jobs are seeded per company and run in that company's tenant; daily jobs take "today" in the company timezone (GLB-09).

| Code | Default schedule | What it does |
|------|------------------|--------------|
| `propertyManagement.reservationExpirationReminder` | daily 08:10 | Client email + in-app reminder 3 days / 1 day / on the day before an unpaid reservation expires; then ends unpaid active reservations whose expiration day is over (`endReservation`: status expired, pending commission voided, unit freed, each in its own transaction) and sends the `RESERVATION_EXPIRED` staff notice (in-app + email) to the reservation's agent and the reservation watchers. The client's "expired" email stays a manual action |
| `propertyManagement.paymentPlanInstallmentReminder` | daily 08:12 | Buyer emails for upcoming installments (3d / 1d / day-of) and one overdue notice |
| `propertyManagement.leaseRentReminder` | daily 08:14 | Tenant emails for upcoming rent (3d / 1d / day-of) and one overdue notice |
| `propertyManagement.rentalMaintenance` | daily 08:15 | Marks overdue rent payments, stamps late fees, expires leases past their end date (waives open payments, frees units) |
| `propertyManagement.modificationRequestSla` | daily 08:20 | Emits `MODIFICATION_REQUEST_SLA_BREACHED` for requests past their stage due date |
| `propertyManagement.adCampaignDispatch` | every minute (timeout 280 s) | Sends scheduled / in-progress ad campaigns |
| `propertyManagement.adCampaignReclaim` | every 10 minutes | Frees recipients and campaigns stranded by a dead worker |

## Kafka

Kafka is optional (BE-10). Client emails are published to Kafka when it is on; `publishEvent` returning `false` falls back to sending in-process.

| Producer (`kafka/kafkaProducer.ts`) | Topic env var | Used by |
|-------------------------------------|---------------|---------|
| `publishReservationClientEmailEvent` | `KAFKA_TOPIC_RESERVATION_CLIENT_EMAIL` | `utilities/database/reservation/reservationClientEmailDispatch.ts` (SMTP fallback) |
| `publishSaleClientEmailEvent` | `KAFKA_TOPIC_SALE_CLIENT_EMAIL` | not called today: `saleClientEmailDispatch.ts` sends sale emails directly |

Consumers: `startRealEstateKafkaConsumers` (`kafka/kafkaConsumer.ts`, started by the Kafka server through core `startAllKafkaConsumers`) consumes both topics (`reservation_client_email`, `sale_client_email` events) and sends the emails. It does nothing when Kafka is disabled.

### Environment variables (`environment.ts`)

All four are required only when Kafka is enabled (`environment.validator.ts`); there are no defaults.

| Variable | Meaning |
|----------|---------|
| `KAFKA_TOPIC_RESERVATION_CLIENT_EMAIL` | Topic for reservation client emails |
| `KAFKA_TOPIC_SALE_CLIENT_EMAIL` | Topic for sale client emails |
| `KAFKA_CONSUMER_GROUP_RESERVATION_CLIENT_EMAIL` | Consumer group for the reservation topic |
| `KAFKA_CONSUMER_GROUP_SALE_CLIENT_EMAIL` | Consumer group for the sale topic |

## Notifications

Codes are declared in `domain/notifications/notificationEventCodes.ts`, emitted with core `emitNotificationEvent` (after commit) and turned into in-app notifications by `registerRealEstateNotificationEventHandlers` (`domain/notifications/realEstateNotificationHandlers.ts`).

| Group | Codes | Receivers |
|-------|-------|-----------|
| Reservations (client) | `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `RESERVATION_REINSTATED`, `RESERVATION_PAID`, `RESERVATION_PAYMENT_REVERSED`, `RESERVATION_EXPIRATION_REMINDER` | The reservation's client |
| Staff watchers | `RESERVATION_CREATED_STAFF`, `SALE_CREATED_STAFF`, `RESERVATION_EXPIRED` | `PropertyManagementConfig.notifyOnReservations` / `notifyOnSales` users (in-app + email); `RESERVATION_EXPIRED` also goes to the reservation's agent (`reservedBy`) |
| Sales | `SALE_CREATED`, `SALE_PENDING_APPROVAL`, `SALE_APPROVED`, `SALE_REJECTED` | Buyer (`SALE_CREATED`); seller (`SALE_PENDING_APPROVAL`); seller + buyer (`SALE_APPROVED` / `SALE_REJECTED`) |
| Commissions | `COMMISSION_PENDING_APPROVAL`, `COMMISSION_APPROVAL_REJECTED`, `COMMISSION_PAID` | The agent (`COMMISSION_PAID`, `COMMISSION_APPROVAL_REJECTED`); the requesting user (`COMMISSION_PENDING_APPROVAL`) |
| Payment plans | `PAYMENT_PLAN_DOWN_PAYMENT_PAID`, `PAYMENT_PLAN_INSTALLMENT_PAID`, `PAYMENT_PLAN_COMPLETED`, `PAYMENT_PLAN_DEFAULTED` | Buyer (`PAYMENT_PLAN_DEFAULTED`: the users the sale action picks) |
| Modification requests | `MODIFICATION_REQUEST_CREATED`, `_APPROVED`, `_REJECTED`, `_CANCELLED`, `_FINANCE_ADDED`, `_CLIENT_COST_PENDING`, `_CLIENT_COST_APPROVED`, `_CLIENT_COST_REJECTED`, `_REVISION_SUBMITTED`, `_REACTIVATED`, `_SLA_BREACHED`, `_DELIVERED` | The requester (`requestedBy`) |
| Construction progress | `CONSTRUCTION_PROGRESS_UPDATE` | Clients holding units in the project/building |
| propertyDevelopment (emitted by PD, handled here) | `PROJECT_DOCUMENT_*` (5), `PERMIT_*` (6), `MILESTONE_*` (3), `SCHEDULE_TASK_*` (2), `RFI_OPENED`, `RFI_ANSWERED`, `VARIATION_ORDER_APPROVED`, `VARIATION_ORDER_REJECTED`, `BUDGET_APPROVED`, `PROGRESS_CLAIM_SUBMITTED`, `SAFETY_INCIDENT_REPORTED` | Receivers chosen by the PD action |

Emitted but with no handler yet (no in-app notification is created): `SALE_PENDING_APPROVAL`, `SALE_APPROVED`, `SALE_REJECTED`, `COMMISSION_PENDING_APPROVAL`, `COMMISSION_APPROVAL_REJECTED`, `MODIFICATION_REQUEST_CLIENT_COST_PENDING`, `_CLIENT_COST_APPROVED`, `_CLIENT_COST_REJECTED`, `_REVISION_SUBMITTED`, `_REACTIVATED`, `_SLA_BREACHED`. `MODIFICATION_REQUEST_FINANCE_ADDED` has a handler but nothing emits it.

## Other contributions

| Seam | Where |
|------|-------|
| Person eraser (SEC-06) | `registerPropertyManagementPersonErasers` — `utilities/erasure/propertyManagementPersonEraser.ts` |
| Core portal provider | `registerPropertiesPortalProvider` — `domain/portal/propertiesPortalProvider.ts` |
| Assistant tools | `domain/ai/tools/` |
| WebSocket room names | `registerPropertyManagementRoomContributions` — `websocket/roomContribution.ts` |

## Path alias

```ts
import Unit from "@propertyManagement/database/schemas/unit/unit";
import {createSaleFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/createSale.form.validator";
```

## Related packages

| Package | Location |
|---------|----------|
| Armonia contracts | [`armonia/src/modules/propertyManagement`](../../../armonia/src/modules/propertyManagement/README.md) |
| Client UI | `sinfonia/src/modules/propertyManagement/` |

## Scripts

Run from `maestro/`:

```bash
npm run dev:propertyManagement     # api, websocket, kafka and cron on the propertyManagement dev profile
npm run reset:propertyManagement   # reset the profile's database with demo data (destructive)
npm run fetch:opencv-js            # download vendor/opencv.js for the floor/unit generator
npm run preview:emails             # render email previews
```
