import type {DefaultRoleDefinition} from "@coreModule/database/schemas/role/role.defaults";

const INV = ["Projects", "Edifices", "Floors", "Units"];
const DASH = ["Dashboardcaches"];

const inventoryOwn = [
    "Projects",
    "Edifices",
    "Floors",
    "Units",
    "Unittypes",
    "Unittypecategories",
    "Constructors",
];
const unitCostOwn = ["Unitcosts"];
const marketingOwn = ["Stories", "Storytypes"];
const constructionUpdateOwn = ["Constructionupdates"];
const portfolioOwn = unique([...inventoryOwn, ...unitCostOwn, ...marketingOwn, ...constructionUpdateOwn]);

const leadOwn = ["Leads"];
const salesAgentOwn = ["Reservations", "Sales", "Signaturerequests"];
const collectionsOwn = ["Paymentplans"];
const commissionOwn = ["Commissions"];
const contractsOwn = ["Signaturerequests", "Sales", "Leases"];
const salesManagerOwn = unique([
    ...leadOwn,
    ...salesAgentOwn,
    ...collectionsOwn,
    ...commissionOwn,
    ...contractsOwn,
]);

const leasingOwn = ["Leases"];
const rentOwn = ["Rentalpayments"];
const leasingManagerOwn = unique([...leasingOwn, ...rentOwn, "Inspections"]);

const changeOrderOwn = ["Modificationrequests"];
const inspectorOwn = ["Inspections"];
const snagOwn = ["Snags"];
const aftercareOwn = unique([...inspectorOwn, ...snagOwn]);

const allOwn = unique([
    ...portfolioOwn,
    ...salesManagerOwn,
    ...leasingManagerOwn,
    ...changeOrderOwn,
    ...aftercareOwn,
]);

const allRead = unique([...allOwn, ...INV, ...DASH, "Reservations"]);

function unique(values: string[]): string[] {
    return [...new Set(values)];
}

function reRole(
    name: string,
    slug: string,
    description: string,
    permissionGroups: string[],
    readPermissionGroups: string[],
): DefaultRoleDefinition {
    return {
        name,
        slug,
        description,
        isAdmin: false,
        isSignupDefault: false,
        canEdit: true,
        canDelete: false,
        permissionGroups,
        readPermissionGroups,
    };
}

export const realEstateDefaultRoles: DefaultRoleDefinition[] = [
    reRole(
        "Inventory Manager",
        "re_inventory_manager",
        "Sets up the portfolio: projects, edifices, floors, units, unit types, and constructors.",
        inventoryOwn,
        [...DASH],
    ),
    reRole(
        "Unit Cost Controller",
        "re_unit_cost_controller",
        "Maintains unit cost records. Can look up inventory but cannot change projects or units.",
        unitCostOwn,
        [...INV, ...DASH],
    ),
    reRole(
        "Marketing Editor",
        "re_marketing_editor",
        "Publishes project and unit stories. Can look up inventory but cannot change it.",
        marketingOwn,
        [...INV, ...DASH],
    ),
    reRole(
        "Construction Update Editor",
        "re_construction_update_editor",
        "Posts construction progress updates for buyers. Can look up inventory but cannot change it.",
        constructionUpdateOwn,
        [...INV, ...DASH],
    ),
    reRole(
        "Portfolio Manager",
        "re_portfolio_manager",
        "Runs the full portfolio workflow: inventory, unit costs, stories, and construction updates.",
        portfolioOwn,
        [...DASH],
    ),

    reRole(
        "Lead Officer",
        "re_lead_officer",
        "Captures and qualifies buyer interest. Cannot create reservations or sales.",
        leadOwn,
        [...INV, ...DASH],
    ),
    reRole(
        "Sales Agent",
        "re_sales_agent",
        "Reserves units, converts to sale, and handles handover on the sale. Cannot create leads or commissions.",
        salesAgentOwn,
        [...INV, "Leads", ...DASH],
    ),
    reRole(
        "Collections Officer",
        "re_collections_officer",
        "Manages sale payment-plan installments: schedule, collect, and mark overdue.",
        collectionsOwn,
        [...INV, "Sales", ...DASH],
    ),
    reRole(
        "Commission Officer",
        "re_commission_officer",
        "Records and tracks agent commissions from reservations and sales.",
        commissionOwn,
        [...INV, "Sales", "Reservations", ...DASH],
    ),
    reRole(
        "Contracts Officer",
        "re_contracts_officer",
        "Works the contracts & clients hub: sales, leases, and signature requests.",
        contractsOwn,
        [...INV, "Reservations", ...DASH],
    ),
    reRole(
        "Sales Manager",
        "re_sales_manager",
        "Runs the full sales pipeline: lead → reservation → sale → payment plan → commission.",
        salesManagerOwn,
        [...INV, ...DASH],
    ),

    reRole(
        "Leasing Officer",
        "re_leasing_officer",
        "Creates and terminates leases. Cannot collect rental payments.",
        leasingOwn,
        [...INV, ...DASH],
    ),
    reRole(
        "Rent Collector",
        "re_rent_collector",
        "Collects, waives, and marks rental payments. Cannot create or end leases.",
        rentOwn,
        [...INV, "Leases", ...DASH],
    ),
    reRole(
        "Leasing Manager",
        "re_leasing_manager",
        "Runs the full lease workflow: lease, rent collection, and exit inspection.",
        leasingManagerOwn,
        [...INV, ...DASH],
    ),

    reRole(
        "Change Order Coordinator",
        "re_change_order",
        "Owns buyer modification requests end-to-end, with read access to the related sale and unit.",
        changeOrderOwn,
        [...INV, "Sales", "Reservations"],
    ),

    reRole(
        "Quality Inspector",
        "re_quality_inspector",
        "Performs unit inspections. Cannot manage the snagging list.",
        inspectorOwn,
        [...INV, "Sales", "Leases", "Constructionupdates"],
    ),
    reRole(
        "Snagging Officer",
        "re_snagging_officer",
        "Logs and closes snags. Can look up inspections but cannot create them.",
        snagOwn,
        [...INV, "Inspections", "Constructionupdates"],
    ),
    reRole(
        "Aftercare Manager",
        "re_aftercare_manager",
        "Runs aftercare and quality: inspections and snags through to close-out.",
        aftercareOwn,
        [...INV, "Sales", "Leases", "Constructionupdates"],
    ),

    reRole(
        "Real Estate Analyst",
        "re_analyst",
        "Read-only access for overview, dashboards, agent report, ROI, and ERP export. Cannot change records.",
        [],
        allRead,
    ),
    reRole(
        "Real Estate Manager",
        "re_manager",
        "Operates every visible Real Estate workflow: portfolio, sales, leasing, change orders, and aftercare.",
        allOwn,
        [...DASH],
    ),
];
