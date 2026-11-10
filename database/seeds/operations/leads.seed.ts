/**
 * CRM leads.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {LeadSeedRow} from "./types";

export const leadsSeed: readonly LeadSeedRow[] = [
    {
        "id": "6a5389bc75dbaad1890bb3f9",
        "firstName": "Elena",
        "lastName": "Krasniqi",
        "email": "elena.krasniqi@example.com",
        "phone": "+355 69 222 3344",
        "status": "contacted",
        "source": "referral",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a501b3388c85ab828433c4e",
        "budget": "420000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A0-02 Floor 0. [pm-demo-seed]",
        "assignedTo": {
            "$user": "skerd@xhafa.com"
        },
        "followUpDate": "2026-07-15",
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-03T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to contacted",
                "performedBy": {
                    "$user": "skerd@xhafa.com"
                },
                "performedAt": "2026-07-08T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3fa",
        "firstName": "James",
        "lastName": "Whitfield",
        "email": "j.whitfield@example.com",
        "phone": "+44 7700 900123",
        "status": "qualified",
        "source": "event",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a5018e588c85ab828431af5",
        "budget": "510000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A0-03 Floor 0. [pm-demo-seed]",
        "assignedTo": {
            "$user": "eniada.halebi@pronix.com"
        },
        "followUpDate": "2026-07-16",
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-04T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to qualified",
                "performedBy": {
                    "$user": "eniada.halebi@pronix.com"
                },
                "performedAt": "2026-07-09T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3fb",
        "firstName": "Sofia",
        "lastName": "Rossi",
        "email": "sofia.rossi@example.com",
        "phone": "+39 340 555 6677",
        "status": "proposal",
        "source": "social",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a501e2588c85ab8284360da",
        "budget": "460000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A1-01 Floor 1. [pm-demo-seed]",
        "assignedTo": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "followUpDate": "2026-07-17",
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-05T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to proposal",
                "performedBy": {
                    "$user": "gerald.habilaj@pronix.com"
                },
                "performedAt": "2026-07-10T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3fc",
        "firstName": "Arben",
        "lastName": "Hoxha",
        "email": "arben.hoxha@example.com",
        "phone": "+355 68 777 8899",
        "status": "negotiation",
        "source": "walk_in",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a501b3388c85ab828433c31",
        "budget": "350000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A0-01 Floor 0. [pm-demo-seed]",
        "assignedTo": {
            "$user": "almir@leka.com"
        },
        "followUpDate": "2026-07-18",
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-06T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to negotiation",
                "performedBy": {
                    "$user": "almir@leka.com"
                },
                "performedAt": "2026-07-11T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3fd",
        "firstName": "Claire",
        "lastName": "Dupont",
        "email": "claire.dupont@example.com",
        "phone": "+33 6 12 34 56 78",
        "status": "won",
        "source": "referral",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a5018e488c85ab828431ad6",
        "budget": "490000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A0-02 Floor 0. [pm-demo-seed]",
        "assignedTo": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "followUpDate": null,
        "convertedAt": "2026-07-09T12:34:03.627Z",
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-07T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to won",
                "performedBy": {
                    "$user": "geraldo.cucaj@pronix.com"
                },
                "performedAt": "2026-07-11T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3fe",
        "firstName": "Nikolas",
        "lastName": "Papadopoulos",
        "email": "n.papadopoulos@example.com",
        "phone": "+30 694 111 2233",
        "status": "lost",
        "source": "cold_call",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a501b3388c85ab828433c6c",
        "budget": "300000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A0-03 Floor 0. [pm-demo-seed]",
        "assignedTo": {
            "$user": "echo@echo.com"
        },
        "followUpDate": null,
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-08T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to lost",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-11T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3ff",
        "firstName": "Amira",
        "lastName": "Hassan",
        "email": "amira.hassan@example.com",
        "phone": "+971 50 123 4567",
        "status": "new",
        "source": "website",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a5018e588c85ab828431b65",
        "budget": "620000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A1-01 Floor 1. [pm-demo-seed]",
        "assignedTo": {
            "$user": "skerd@xhafa.com"
        },
        "followUpDate": "2026-07-21",
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-09T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to new",
                "performedBy": {
                    "$user": "skerd@xhafa.com"
                },
                "performedAt": "2026-07-11T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a5389bc75dbaad1890bb3f8",
        "firstName": "Marco",
        "lastName": "Bianchi",
        "email": "marco.bianchi@example.com",
        "phone": "+39 333 111 2233",
        "status": "new",
        "source": "website",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a5018e488c85ab828431ab5",
        "budget": "380000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Demo lead for Aria Residence / A0-01 Floor 0. [pm-demo-seed]",
        "assignedTo": {
            "$user": "echo@echo.com"
        },
        "followUpDate": "2026-07-14",
        "convertedAt": null,
        "activityLog": [
            {
                "action": "created",
                "notes": "Enquiry received from the project website.",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-02T12:34:03.627Z"
            },
            {
                "action": "status_update",
                "notes": "Moved to new",
                "performedBy": {
                    "$user": "echo@echo.com"
                },
                "performedAt": "2026-07-07T12:34:03.627Z"
            }
        ]
    },
    {
        "id": "6a71d5acef08a95eca6c3910",
        "firstName": "Dritan",
        "lastName": "Hoxha",
        "email": "dritan.hoxha@example.com",
        "phone": "+355 69 411 2201",
        "status": "new",
        "source": "website",
        "notes": "Asked for the Garda Tower brochure and a Saturday visit.",
        "activityLog": []
    },
    {
        "id": "6a71d771d54e4c588cfa2673",
        "firstName": "Mira",
        "lastName": "Shehu",
        "email": "mira.shehu@example.com",
        "status": "new",
        "source": "website",
        "notes": "Wants a two-bedroom at Aria Residence for summer use.",
        "activityLog": []
    },
    {
        "id": "6a71d7d2d54e4c588cfa293a",
        "firstName": "Klodian",
        "lastName": "Meta",
        "email": "klodian.meta@example.com",
        "phone": "+355 69 411 2203",
        "status": "new",
        "source": "website",
        "notes": "Comparing payment plans on a one-bedroom in Garda Tower.",
        "activityLog": []
    },
    {
        "id": "6a71d8434b8dde9c802d8ce4",
        "firstName": "Arta",
        "lastName": "Dervishi",
        "email": "arta.dervishi@example.com",
        "phone": "+355 69 411 2204",
        "status": "new",
        "source": "website",
        "notes": "Sent from the footer form. Looking for a sea-view apartment in Dhërmi.",
        "activityLog": []
    },
    {
        "id": "6a71efdf174e83b559b59e4f",
        "firstName": "Endrit",
        "lastName": "Kola",
        "email": "endrit.kola@example.com",
        "phone": "+355 69 411 2205",
        "status": "new",
        "source": "website",
        "interest": "investments",
        "notes": "Investor asking about bulk purchase of three units at Dyeus.",
        "activityLog": []
    },
    {
        "id": "6a75dbf12e2050557c35b86b",
        "firstName": "Jonida",
        "lastName": "Prifti",
        "email": "jonida.prifti@example.com",
        "phone": "+355 69 411 2206",
        "status": "new",
        "source": "website",
        "interest": "reservation",
        "notes": "Wants to reserve a Dyeus apartment facing the courtyard.",
        "activityLog": []
    },
    {
        "id": "6a79a4c1bea18fc43a61be23",
        "firstName": "Besnik",
        "lastName": "Leka",
        "email": "besnik.leka@example.com",
        "phone": "+355 69 411 2207",
        "status": "new",
        "source": "website",
        "interest": "reservation",
        "projectInterest": "6a4f94ae99511ee1e0efb78a",
        "unitInterest": "6a5018e588c85ab828431bd5",
        "notes": "Enquiry for unit A2-01 on floor 2 at Aria Residence.",
        "activityLog": []
    },
    {
        "id": "6a7e32a5f5ff1360699ac214",
        "firstName": "Sara",
        "lastName": "Berisha",
        "email": "sara.berisha@example.com",
        "phone": "+355 69 411 2208",
        "status": "new",
        "source": "chat",
        "notes": "Asked in chat which units at Aria Residence are still available.",
        "activityLog": []
    },
    {
        "id": "6a7e40a8eaed17d8d684e733",
        "firstName": "Ilir",
        "lastName": "Gjoni",
        "email": "ilir.gjoni@example.com",
        "phone": "+355 69 411 2209",
        "status": "new",
        "source": "chat",
        "budget": "350000",
        "budgetCurrency": {
            "$currency": "EUR"
        },
        "notes": "Budget of 350,000 euro for a two-bedroom with a sea view.",
        "activityLog": []
    }
];
