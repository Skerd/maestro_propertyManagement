# Property Management Module (Maestro)

Server-side implementation of real-estate and property-management operations: projects, buildings, units, sales, leasing, construction tracking, and reporting.

Contracts live in **armonia** at `armonia/src/modules/propertyManagement/`. This module implements persistence, routes, domain logic, and integrations (Kafka, ERP export, PDF/floor-plan tooling).

Enable via `ENABLED_MODULES=propertyManagement`.

## Directory layout

```
propertyManagement/
├── api/realEstate/private/        # Express routes
├── database/
│   ├── moduleBootstrap.ts
│   └── schemas/<resource>/
├── domain/
│   └── notifications/             # Property notification handlers
├── kafka/                         # Kafka event producers/consumers
└── utilities/
    ├── contractsHub/              # Contract hub aggregation
    ├── cron/ & cronJobs/          # Scheduled jobs (payments, reminders, …)
    ├── database/                  # Transaction helpers (reservation, sale)
    ├── edifice/                   # Floor/unit generation (incl. OpenCV tooling)
    ├── emails/                    # Property-specific email templates
    ├── mappers/                   # DTO mappers
    └── …                          # ERP export, dashboard caches, ROI, etc.
```

## API routes

### Portfolio structure

| Route file | Description |
|------------|-------------|
| `project.ts` | Development projects |
| `edifice.ts` | Buildings |
| `floor.ts` | Floors |
| `unitType.ts` / `unitTypeCategory.ts` | Unit typologies |
| `unit/` | Units, reservations, sales, payment plans, inspections, modifications |
| `constructor.ts` | Construction companies |

### Sales & leasing

| Route file | Description |
|------------|-------------|
| `lead.ts` | Sales leads |
| `commission.ts` | Agent commissions |
| `lease.ts` | Rental agreements |
| `rentalPayment.ts` | Rent payments |
| `rentalsHub.ts` | Rental operations hub |
| `contractsHub.ts` | Contract management hub |

### Operations & reporting

| Route file | Description |
|------------|-------------|
| `constructionUpdate.ts` | Build progress |
| `snag.ts` | Defect tracking |
| `dashboard.ts` / `groupDashboard.ts` | Dashboards |
| `agentReport.ts` | Agent reports |
| `roi.ts` | ROI calculations |
| `erpExport.ts` | ERP integration export |

## Database models

Registered in `database/moduleBootstrap.ts`:

`Project`, `Edifice`, `Floor`, `Unit`, `UnitCost`, `UnitType`, `UnitTypeCategory`, `Constructor`, `Inspection`, `ModificationRequest`, `Reservation`, `Sale`, `PaymentPlan`, `Commission`, `Lead`, `ConstructionUpdate`, `Snag`, `Lease`, `RentalPayment`

Additional cache schemas (e.g. `dashboardCache`) load via side-effect imports.

## Notable utilities

- **Floor/unit generator** — `utilities/edifice/floorAndUnitsGenerator/` (OpenCV-assisted floor-plan parsing; see `npm run test:floor-opencv-runF`)
- **Contracts hub** — aggregates contract data across sales and leases
- **Cron jobs** — payment reminders, reservation expiry, construction updates
- **Kafka** — async events for cross-service workflows

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

```bash
npm run seed:edifice-demo              # seed demo edifice data
npm run migrate:floor-level-numbers    # floor level migration
npm run test:floor-opencv-runF         # floor-plan generator test
```
