import {registerRoomDisplayNames} from "@coreModule/websocket/roomRegistry";

export function registerPropertyManagementRoomContributions(): void {
    registerRoomDisplayNames({
        overview: "Overview",
        dashboard: "Dashboard",
        projects: "Projects",
        edifices: "Edifices",
        floors: "Floors",
        units: "Units",
        leads: "Leads",
        inspections: "Inspections",
        modificationRequests: "Modification requests",
        reservations: "Reservations",
        sales: "Sales",
        contractsHub: "Contracts hub",
        commissions: "Commissions",
        rentalsHub: "Rentals hub",
        ownerPortal: "Owner portal",
        leases: "Leases",
        rentalPayments: "Rental payments",
        groupDashboard: "Group dashboard",
        agentReport: "Agent report",
        roi: "ROI",
        erpExport: "ERP export",
        unitCosts: "Unit costs",
        unitTypes_configurations: "Unit types configurations",
        unitTypeCategories_configurations: "Unit type categories configurations",
        constructors_configurations: "Constructors configurations",
        handoverPackages: "Handover Packages",
        inspectionChecklistTemplates: "Inspection Checklist Templates",
    });
}
