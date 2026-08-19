/**
 * Unit inspections.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {InspectionSeedRow} from "./types";

export const inspectionsSeed: readonly InspectionSeedRow[] = [
    {
        "id": "6a5389bc75dbaad1890bb3d0",
        "unit": "6a5018e488c85ab828431ab5",
        "inspectedBy": {
            "$user": "echo@echo.com"
        },
        "inspectionDate": "2026-06-28T12:34:03.627Z",
        "scheduledDate": "2026-06-22T12:34:03.627Z",
        "type": "initial",
        "status": "completed",
        "notes": "Demo inspection for A0-01 Floor 0. [pm-demo-seed]",
        "followUpRequired": true,
        "findings": {
            "structuralIssues": [],
            "electricalIssues": [],
            "plumbingIssues": [
                {
                    "notes": "Slow drain in guest bathroom",
                    "severity": "medium"
                }
            ],
            "hvacIssues": [],
            "safetyConcerns": [],
            "cosmeticIssues": [
                {
                    "notes": "Minor paint imperfections near window frames",
                    "severity": "low"
                }
            ],
            "otherObservations": []
        },
        "rating": 6,
        "completedAt": "2026-06-28T12:34:03.627Z",
        "nextInspectionDate": "2026-08-11T12:34:03.627Z"
    },
    {
        "id": "6a5389bc75dbaad1890bb3d1",
        "unit": "6a5018e588c85ab828431af5",
        "inspectedBy": {
            "$user": "skerd@xhafa.com"
        },
        "inspectionDate": "2026-07-16T12:34:03.627Z",
        "scheduledDate": "2026-06-23T12:34:03.627Z",
        "type": "routine",
        "status": "scheduled",
        "notes": "Demo inspection for A0-03 Floor 0. [pm-demo-seed]",
        "followUpRequired": false
    },
    {
        "id": "6a5389bc75dbaad1890bb3d2",
        "unit": "6a5018e588c85ab828431b65",
        "inspectedBy": {
            "$user": "eniada.halebi@pronix.com"
        },
        "inspectionDate": "2026-07-17T12:34:03.627Z",
        "scheduledDate": "2026-06-24T12:34:03.627Z",
        "type": "pre_sale",
        "status": "in_progress",
        "notes": "Demo inspection for A1-01 Floor 1. [pm-demo-seed]",
        "followUpRequired": false
    },
    {
        "id": "6a5389bc75dbaad1890bb3d3",
        "unit": "6a501e2588c85ab8284360f5",
        "inspectedBy": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "inspectionDate": "2026-07-01T12:34:03.627Z",
        "scheduledDate": "2026-06-25T12:34:03.627Z",
        "type": "follow_up",
        "status": "completed",
        "notes": "Demo inspection for A1-02 Floor 1. [pm-demo-seed]",
        "followUpRequired": true,
        "findings": {
            "structuralIssues": [],
            "electricalIssues": [],
            "plumbingIssues": [],
            "hvacIssues": [],
            "safetyConcerns": [],
            "cosmeticIssues": [
                {
                    "notes": "Minor paint imperfections near window frames",
                    "severity": "low"
                }
            ],
            "otherObservations": []
        },
        "rating": 9,
        "completedAt": "2026-07-01T12:34:03.627Z",
        "nextInspectionDate": "2026-08-11T12:34:03.627Z"
    },
    {
        "id": "6a5389bc75dbaad1890bb3d4",
        "unit": "6a501f4c88c85ab828436aed",
        "inspectedBy": {
            "$user": "almir@leka.com"
        },
        "inspectionDate": "2026-07-19T12:34:03.627Z",
        "scheduledDate": "2026-06-26T12:34:03.627Z",
        "type": "final",
        "status": "scheduled",
        "notes": "Demo inspection for A1-04 Floor 1. [pm-demo-seed]",
        "followUpRequired": false
    },
    {
        "id": "6a5389bc75dbaad1890bb3d5",
        "unit": "6a501b3488c85ab828433d3d",
        "inspectedBy": {
            "$user": "geraldo.cucaj@pronix.com"
        },
        "inspectionDate": "2026-07-03T12:34:03.627Z",
        "scheduledDate": "2026-06-27T12:34:03.627Z",
        "type": "initial",
        "status": "completed",
        "notes": "Demo inspection for A1-06 Floor 1. [pm-demo-seed]",
        "followUpRequired": false,
        "findings": {
            "structuralIssues": [],
            "electricalIssues": [],
            "plumbingIssues": [],
            "hvacIssues": [],
            "safetyConcerns": [],
            "cosmeticIssues": [
                {
                    "notes": "Minor paint imperfections near window frames",
                    "severity": "low"
                }
            ],
            "otherObservations": []
        },
        "rating": 7,
        "completedAt": "2026-07-03T12:34:03.627Z"
    },
    {
        "id": "6a5389bc75dbaad1890bb3d6",
        "unit": "6a5018e588c85ab828431bd5",
        "inspectedBy": {
            "$user": "echo@echo.com"
        },
        "inspectionDate": "2026-07-21T12:34:03.627Z",
        "scheduledDate": "2026-06-28T12:34:03.627Z",
        "type": "routine",
        "status": "scheduled",
        "notes": "Demo inspection for A2-01 Floor 2. [pm-demo-seed]",
        "followUpRequired": true,
        "nextInspectionDate": "2026-08-11T12:34:03.627Z"
    },
    {
        "id": "6a5389bc75dbaad1890bb3d7",
        "unit": "6a501f4c88c85ab828436b76",
        "inspectedBy": {
            "$user": "skerd@xhafa.com"
        },
        "inspectionDate": "2026-07-22T12:34:03.627Z",
        "scheduledDate": "2026-06-29T12:34:03.627Z",
        "type": "pre_sale",
        "status": "in_progress",
        "notes": "Demo inspection for A2-02 Floor 2. [pm-demo-seed]",
        "followUpRequired": false
    },
    {
        "id": "6a5389bc75dbaad1890bb3d8",
        "unit": "6a501b3488c85ab828433de7",
        "inspectedBy": {
            "$user": "eniada.halebi@pronix.com"
        },
        "inspectionDate": "2026-07-06T12:34:03.627Z",
        "scheduledDate": "2026-06-30T12:34:03.627Z",
        "type": "follow_up",
        "status": "completed",
        "notes": "Demo inspection for A2-04 Floor 2. [pm-demo-seed]",
        "followUpRequired": false,
        "findings": {
            "structuralIssues": [],
            "electricalIssues": [],
            "plumbingIssues": [
                {
                    "notes": "Slow drain in guest bathroom",
                    "severity": "medium"
                }
            ],
            "hvacIssues": [],
            "safetyConcerns": [],
            "cosmeticIssues": [
                {
                    "notes": "Minor paint imperfections near window frames",
                    "severity": "low"
                }
            ],
            "otherObservations": []
        },
        "rating": 6,
        "completedAt": "2026-07-06T12:34:03.627Z"
    },
    {
        "id": "6a5389bc75dbaad1890bb3d9",
        "unit": "6a501b3488c85ab828433e51",
        "inspectedBy": {
            "$user": "gerald.habilaj@pronix.com"
        },
        "inspectionDate": "2026-07-24T12:34:03.627Z",
        "scheduledDate": "2026-07-01T12:34:03.627Z",
        "type": "final",
        "status": "scheduled",
        "notes": "Demo inspection for A3-02 Floor 3. [pm-demo-seed]",
        "followUpRequired": true,
        "nextInspectionDate": "2026-08-11T12:34:03.627Z"
    }
];
