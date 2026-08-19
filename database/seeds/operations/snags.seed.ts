/**
 * Defect / snag list entries.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {SnagSeedRow} from "./types";

export const snagsSeed: readonly SnagSeedRow[] = [
    {
        "id": "6a5389bc75dbaad1890bb3c8",
        "unit": "6a5018e488c85ab828431ab5",
        "title": "Hairline crack in living room plaster",
        "description": "Demo snag raised during handover inspection of A0-01 Floor 0.",
        "location": "Living room — south wall",
        "status": "open",
        "severity": "low",
        "reportedBy": {
            "$user": "echo@echo.com"
        },
        "assignedTo": {
            "$user": "skerd@xhafa.com"
        },
        "dueDate": "2026-07-19T12:34:03.627Z",
        "resolvedAt": null,
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3c9",
        "unit": "6a501b3388c85ab828433c6c",
        "title": "Bathroom tile grout incomplete",
        "description": "Demo snag raised during handover inspection of A0-03 Floor 0.",
        "location": "Master bathroom",
        "status": "in_progress",
        "severity": "medium",
        "reportedBy": {
            "$user": "skerd@xhafa.com"
        },
        "assignedTo": {
            "$user": "eniada.halebi@pronix.com"
        },
        "dueDate": "2026-07-22T12:34:03.627Z",
        "resolvedAt": null,
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3ca",
        "unit": "6a501e2588c85ab8284360da",
        "title": "Balcony door seal draft",
        "description": "Demo snag raised during handover inspection of A1-01 Floor 1.",
        "location": "Living room balcony",
        "status": "open",
        "severity": "medium",
        "reportedBy": {
            "$user": "eniada.halebi@pronix.com"
        },
        "assignedTo": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "dueDate": "2026-07-25T12:34:03.627Z",
        "resolvedAt": null,
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3cb",
        "unit": "6a501f4c88c85ab828436aaf",
        "title": "Kitchen cabinet door misaligned",
        "description": "Demo snag raised during handover inspection of A1-02 Floor 1.",
        "location": "Kitchen",
        "status": "resolved",
        "severity": "low",
        "reportedBy": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "assignedTo": {
            "$user": "almir@leka.com"
        },
        "dueDate": "2026-07-28T12:34:03.627Z",
        "resolvedAt": "2026-07-10T12:34:03.627Z",
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3cc",
        "unit": "6a5018e588c85ab828431ba3",
        "title": "Corridor light fixture flicker",
        "description": "Demo snag raised during handover inspection of A1-03 Floor 1.",
        "location": "Entrance corridor",
        "status": "in_progress",
        "severity": "high",
        "reportedBy": {
            "$user": "almir@leka.com"
        },
        "assignedTo": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "dueDate": "2026-07-31T12:34:03.627Z",
        "resolvedAt": null,
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3cd",
        "unit": "6a501f4c88c85ab828436aed",
        "title": "Window latch sticks on bedroom",
        "description": "Demo snag raised during handover inspection of A1-04 Floor 1.",
        "location": "Bedroom 1",
        "status": "open",
        "severity": "medium",
        "reportedBy": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "assignedTo": {
            "$user": "echo@echo.com"
        },
        "dueDate": "2026-08-03T12:34:03.627Z",
        "resolvedAt": null,
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3ce",
        "unit": "6a501b3488c85ab828433d1e",
        "title": "Paint touch-up needed near skirting",
        "description": "Demo snag raised during handover inspection of A1-05 Floor 1.",
        "location": "Hallway",
        "status": "resolved",
        "severity": "low",
        "reportedBy": {
            "$user": "echo@echo.com"
        },
        "assignedTo": {
            "$user": "skerd@xhafa.com"
        },
        "dueDate": "2026-08-06T12:34:03.627Z",
        "resolvedAt": "2026-07-10T12:34:03.627Z",
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    },
    {
        "id": "6a5389bc75dbaad1890bb3cf",
        "unit": "6a501e2688c85ab828436161",
        "title": "AC condensate drip",
        "description": "Demo snag raised during handover inspection of A2-01 Floor 2.",
        "location": "Living room ceiling unit",
        "status": "open",
        "severity": "critical",
        "reportedBy": {
            "$user": "skerd@xhafa.com"
        },
        "assignedTo": {
            "$user": "eniada.halebi@pronix.com"
        },
        "dueDate": "2026-08-09T12:34:03.627Z",
        "resolvedAt": null,
        "notes": "Auto-generated for UI demos. [pm-demo-seed]"
    }
];
