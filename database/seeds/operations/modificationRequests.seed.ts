/**
 * Client modification requests and their approval chain.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {ModificationRequestSeedRow} from "./types";

export const modificationRequestsSeed: readonly ModificationRequestSeedRow[] = [
    {
        "id": "6a538b10d4b6b1160814e36f",
        "unit": "6a501b3388c85ab828433c31",
        "requestedBy": {
            "$user": "skerd@xhafa.com"
        },
        "title": "Kitchen backsplash upgrade",
        "description": "Replace existing kitchen backsplash with marble tiles. [pm-demo-seed]",
        "constructionType": "cosmetic",
        "specifications": "Demo modification request for UI walkthroughs.",
        "status": "pending_architect",
        "architectApproval": {
            "decision": "pending"
        },
        "engineerApproval": {
            "decision": "pending",
            "materialsPlan": []
        },
        "ceoApproval": {
            "decision": "pending"
        },
        "deliveryApproval": {
            "decision": "pending"
        },
        "notificationSent": false,
        "submittedAt": "2026-06-22T12:39:44.041Z",
        "stageDueDate": "2026-07-17T12:39:44.041Z",
        "completedAt": null,
        "inspections": []
    },
    {
        "id": "6a538b10d4b6b1160814e370",
        "unit": "6a5018e488c85ab828431ad6",
        "requestedBy": {
            "$user": "eniada.halebi@pronix.com"
        },
        "title": "Additional power outlets in living room",
        "description": "Add two double sockets on the south wall for TV and desk. [pm-demo-seed]",
        "constructionType": "electrical",
        "specifications": "Demo modification request for UI walkthroughs.",
        "status": "pending_engineer",
        "architectApproval": {
            "decision": "approved",
            "user": {
                "$user": "skerd@xhafa.com"
            },
            "notes": "Architect OK",
            "reviewedAt": "2026-07-08T12:39:44.041Z"
        },
        "engineerApproval": {
            "decision": "pending",
            "materialsPlan": []
        },
        "ceoApproval": {
            "decision": "pending"
        },
        "deliveryApproval": {
            "decision": "pending"
        },
        "notificationSent": false,
        "submittedAt": "2026-06-23T12:39:44.041Z",
        "stageDueDate": "2026-07-18T12:39:44.041Z",
        "completedAt": null,
        "inspections": []
    },
    {
        "id": "6a538b10d4b6b1160814e371",
        "unit": "6a501b3388c85ab828433c4e",
        "requestedBy": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "title": "Upgrade living room flooring to oak",
        "description": "Replace laminate with engineered oak throughout living area. [pm-demo-seed]",
        "constructionType": "flooring",
        "specifications": "Demo modification request for UI walkthroughs.",
        "status": "pending_ceo",
        "architectApproval": {
            "decision": "approved",
            "user": {
                "$user": "eniada.halebi@pronix.com"
            },
            "notes": "Architect OK",
            "reviewedAt": "2026-07-09T12:39:44.041Z"
        },
        "engineerApproval": {
            "decision": "approved",
            "user": {
                "$user": "gerald.habilaj@pronix.com"
            },
            "notes": "Engineer OK",
            "reviewedAt": "2026-07-10T12:39:44.041Z",
            "materialsPlan": [
                {
                    "item": "Materials package",
                    "quantity": 1,
                    "unit": "set",
                    "notes": "Demo materials",
                    "pricePerUnit": "1200",
                    "currency": {
                        "$currency": "EUR"
                    }
                }
            ]
        },
        "ceoApproval": {
            "decision": "pending"
        },
        "deliveryApproval": {
            "decision": "pending"
        },
        "notificationSent": false,
        "submittedAt": "2026-06-24T12:39:44.041Z",
        "stageDueDate": "2026-07-19T12:39:44.041Z",
        "completedAt": null,
        "inspections": []
    },
    {
        "id": "6a538b10d4b6b1160814e372",
        "unit": "6a501b3388c85ab828433c6c",
        "requestedBy": {
            "$user": "almir@leka.com"
        },
        "title": "Second bathroom vanity upgrade",
        "description": "Install premium dual-sink vanity and rain shower. [pm-demo-seed]",
        "constructionType": "plumbing",
        "specifications": "Demo modification request for UI walkthroughs.",
        "status": "pending_finance",
        "architectApproval": {
            "decision": "approved",
            "user": {
                "$user": "gerald.habilaj@pronix.com"
            },
            "notes": "Architect OK",
            "reviewedAt": "2026-07-10T12:39:44.041Z"
        },
        "engineerApproval": {
            "decision": "approved",
            "user": {
                "$user": "almir@leka.com"
            },
            "notes": "Engineer OK",
            "reviewedAt": "2026-07-07T12:39:44.041Z",
            "materialsPlan": [
                {
                    "item": "Materials package",
                    "quantity": 1,
                    "unit": "set",
                    "notes": "Demo materials",
                    "pricePerUnit": "1200",
                    "currency": {
                        "$currency": "EUR"
                    }
                }
            ]
        },
        "ceoApproval": {
            "decision": "approved",
            "user": {
                "$user": "geraldo.cucaj@pronix.com"
            },
            "notes": "CEO OK",
            "reviewedAt": "2026-07-08T12:39:44.041Z"
        },
        "deliveryApproval": {
            "decision": "pending"
        },
        "notificationSent": false,
        "submittedAt": "2026-06-25T12:39:44.041Z",
        "stageDueDate": "2026-07-20T12:39:44.041Z",
        "completedAt": null,
        "inspections": []
    },
    {
        "id": "6a538b10d4b6b1160814e373",
        "unit": "6a5018e588c85ab828431af5",
        "requestedBy": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "title": "Custom wardrobe in master bedroom",
        "description": "Floor-to-ceiling wardrobe with sliding glass doors. [pm-demo-seed]",
        "constructionType": "materials",
        "specifications": "Demo modification request for UI walkthroughs.",
        "status": "pending_client_approval",
        "architectApproval": {
            "decision": "approved",
            "user": {
                "$user": "almir@leka.com"
            },
            "notes": "Architect OK",
            "reviewedAt": "2026-07-07T12:39:44.041Z"
        },
        "engineerApproval": {
            "decision": "approved",
            "user": {
                "$user": "geraldo.cucaj@pronix.com"
            },
            "notes": "Engineer OK",
            "reviewedAt": "2026-07-08T12:39:44.041Z",
            "materialsPlan": [
                {
                    "item": "Materials package",
                    "quantity": 1,
                    "unit": "set",
                    "notes": "Demo materials",
                    "pricePerUnit": "1200",
                    "currency": {
                        "$currency": "EUR"
                    }
                }
            ]
        },
        "ceoApproval": {
            "decision": "approved",
            "user": {
                "$user": "echo@echo.com"
            },
            "notes": "CEO OK",
            "reviewedAt": "2026-07-09T12:39:44.041Z"
        },
        "deliveryApproval": {
            "decision": "pending"
        },
        "notificationSent": false,
        "submittedAt": "2026-06-26T12:39:44.041Z",
        "stageDueDate": "2026-07-21T12:39:44.041Z",
        "completedAt": null,
        "inspections": [],
        "financeDetails": {
            "totalCost": 7700,
            "currency": {
                "$currency": "EUR"
            },
            "costBreakdown": [
                {
                    "item": "Labor",
                    "cost": 2600,
                    "quantity": 1,
                    "unit": "lot",
                    "source": "manual"
                },
                {
                    "item": "Materials",
                    "cost": 5100,
                    "quantity": 1,
                    "unit": "set",
                    "source": "engineer_material"
                }
            ],
            "notes": "Demo finance estimate",
            "estimatedCompletionDate": "2026-08-11T12:39:44.041Z"
        },
        "clientCostApproval": {
            "decision": "pending"
        }
    },
    {
        "id": "6a538b10d4b6b1160814e374",
        "unit": "6a5018e588c85ab828431b12",
        "requestedBy": {
            "$user": "echo@echo.com"
        },
        "title": "Split AC upgrade to inverter units",
        "description": "Replace existing split units with energy-efficient inverter models. [pm-demo-seed]",
        "constructionType": "hvac",
        "specifications": "Demo modification request for UI walkthroughs.",
        "status": "completed",
        "architectApproval": {
            "decision": "approved",
            "user": {
                "$user": "geraldo.cucaj@pronix.com"
            },
            "notes": "Architect OK",
            "reviewedAt": "2026-07-08T12:39:44.041Z"
        },
        "engineerApproval": {
            "decision": "approved",
            "user": {
                "$user": "echo@echo.com"
            },
            "notes": "Engineer OK",
            "reviewedAt": "2026-07-09T12:39:44.041Z",
            "materialsPlan": [
                {
                    "item": "Materials package",
                    "quantity": 1,
                    "unit": "set",
                    "notes": "Demo materials",
                    "pricePerUnit": "1200",
                    "currency": {
                        "$currency": "EUR"
                    }
                }
            ]
        },
        "ceoApproval": {
            "decision": "approved",
            "user": {
                "$user": "skerd@xhafa.com"
            },
            "notes": "CEO OK",
            "reviewedAt": "2026-07-10T12:39:44.041Z"
        },
        "deliveryApproval": {
            "decision": "approved",
            "user": {
                "$user": "echo@echo.com"
            },
            "notes": "Delivered",
            "reviewedAt": "2026-07-07T12:39:44.041Z",
            "inspections": []
        },
        "notificationSent": true,
        "submittedAt": "2026-06-27T12:39:44.041Z",
        "stageDueDate": null,
        "completedAt": "2026-07-10T12:39:44.041Z",
        "inspections": [],
        "financeDetails": {
            "totalCost": 8500,
            "currency": {
                "$currency": "EUR"
            },
            "costBreakdown": [
                {
                    "item": "Labor",
                    "cost": 2800,
                    "quantity": 1,
                    "unit": "lot",
                    "source": "manual"
                },
                {
                    "item": "Materials",
                    "cost": 5700,
                    "quantity": 1,
                    "unit": "set",
                    "source": "engineer_material"
                }
            ],
            "notes": "Demo finance estimate",
            "estimatedCompletionDate": "2026-08-11T12:39:44.041Z"
        },
        "clientCostApproval": {
            "decision": "approved",
            "user": {
                "$user": "geraldo.cucaj@pronix.com"
            },
            "notes": "Client accepted estimate",
            "reviewedAt": "2026-07-08T12:39:44.041Z"
        },
        "clientNotifiedAt": "2026-07-11T12:39:44.041Z"
    }
];
