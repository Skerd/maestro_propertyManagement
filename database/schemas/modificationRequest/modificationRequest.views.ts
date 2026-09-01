import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    MODIFICATION_REQUEST_LONG_TEXT_MAX,
    MODIFICATION_REQUEST_TITLE_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/modificationRequest/modificationRequest.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const modificationRequestSheetView: ViewConfig = {
    model: "modificationrequests",
    viewType: "sheet",
    accessModel: "modificationRequests",
    apiUrl: "/api/realEstate/unit/modificationRequest",
    header: {
        titleField: "title",
        subtitleKey: "modificationRequest",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            permissions: {
                readAny: ["title", "name", "constructionType", "status", "unit", "requestedBy"],
            },
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "title" },
                            field: {
                                name: "title",
                                widget: "#DisplayCard",
                                label: "title",
                                widgetProps: { icon: "#IconLabel" },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: { icon: "#IconLabel" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "constructionType" },
                            field: {
                                name: "constructionType",
                                widget: "#DisplayCard",
                                label: "constructionType",
                                widgetProps: { icon: "#Hammer", languageKeyCategory: "constructionTypes", type: "enum" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "status" },
                            field: {
                                name: "status",
                                widget: "#DisplayCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statuses", type: "enum",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        pending_architect: "warning",
                                        pending_engineer: "warning",
                                        pending_ceo: "warning",
                                        pending_architect_revision: "warning",
                                        pending_engineer_revision: "warning",
                                        pending_finance: "warning",
                                        pending_client_approval: "warning",
                                        finance_completed: "info",
                                        pending_delivery: "warning",
                                        completed: "success",
                                        cancelled: "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "unit" },
                            field: {
                                name: "unit",
                                widget: "#DisplayCard",
                                label: "unit",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    linkedRefPath: "unit",
                                    linkedSheetModel: "units",
                                    linkedSheetWidget: "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                    parent: "unit",
                                    valuePath: ["name", "unitNumber", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "requestedBy" },
                            field: {
                                name: "requestedBy",
                                widget: "#DisplayCard",
                                label: "requestedBy",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "requestedBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "description" },
                            dependent: "description",
                            field: {
                                name: "description",
                                widget: "#DisplayCard",
                                label: "description",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "specifications" },
                            dependent: "specifications",
                            field: {
                                name: "specifications",
                                widget: "#DisplayCard",
                                label: "specifications",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: {
                readAny: ["submittedAt", "stageDueDate", "completedAt", "cancelledAt", "financeDetails"],
            },
            props: { title: "dates" },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "submittedAt" },
                            field: {
                                name: "submittedAt",
                                widget: "#DisplayCard",
                                label: "submittedAt",
                                widgetProps: { icon: "#Calendar", format: "dateTime" , type: "dateTime"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "stageDueDate" },
                            field: {
                                name: "stageDueDate",
                                widget: "#DisplayCard",
                                label: "stageDueDate",
                                widgetProps: { icon: "#CalendarClock", format: "dateTime" , type: "dateTime"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "completedAt" },
                            field: {
                                name: "completedAt",
                                widget: "#DisplayCard",
                                label: "completedAt",
                                widgetProps: { icon: "#CalendarCheck", format: "dateTime" , type: "dateTime"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "cancelledAt" },
                            field: {
                                name: "cancelledAt",
                                widget: "#DisplayCard",
                                label: "cancelledAt",
                                widgetProps: { icon: "#XCircle", format: "dateTime" , type: "dateTime"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "financeDetails" },
                            field: {
                                name: "financeDetails.estimatedCompletionDate",
                                widget: "#DisplayCard",
                                label: "estimatedCompletionDate",
                                widgetProps: { icon: "#Calendar", format: "dateTime" , type: "dateTime"},
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["architectApproval"] },
            props: { title: "architectApproval" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg border bg-blue-500/5 border-blue-500/20 space-y-2" },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "architectApproval" },
                                    field: {
                                        name: "architectApproval.decision",
                                        widget: "#DisplayCard",
                                        label: "decision",
                                        widgetProps: { icon: "#CircleDot", languageKeyCategory: "decisions", type: "enum" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "architectApproval" },
                                    field: {
                                        name: "architectApproval.user",
                                        widget: "#DisplayCard",
                                        label: "reviewedBy",
                                        widgetProps: {
                                            icon: "#User",
                                            parent: "architectApproval.user",
                                            valuePath: ["name", "surname"],
                                            joinSeparator: " ",
                                            type: "user",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "architectApproval" },
                                    field: {
                                        name: "architectApproval.reviewedAt",
                                        widget: "#DisplayCard",
                                        label: "reviewedAt",
                                        widgetProps: { icon: "#CalendarCheck", format: "dateTime" , type: "dateTime"},
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "architectApproval" },
                                    field: {
                                        name: "architectApproval.notes",
                                        widget: "#DisplayCard",
                                        label: "notesLabel",
                                        widgetProps: {
                                            icon: "#IconAlignLeft",
                                            expandable: true,
                                            maxLength: 250,
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "architectApproval" },
                                    field: {
                                        name: "architectApproval.media",
                                        widget: "#DisplayCard",
                                        label: "mediaLabel",
                                        widgetProps: {
                                            icon: "#Paperclip",
                                            type: "media",
                                        },
                                    },
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["engineerApproval"] },
            props: { title: "engineerApproval" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg border bg-violet-500/5 border-violet-500/20 space-y-2" },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.decision",
                                        widget: "#DisplayCard",
                                        label: "decision",
                                        widgetProps: { icon: "#CircleDot", languageKeyCategory: "decisions", type: "enum" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.user",
                                        widget: "#DisplayCard",
                                        label: "reviewedBy",
                                        widgetProps: {
                                            icon: "#User",
                                            parent: "engineerApproval.user",
                                            valuePath: ["name", "surname"],
                                            joinSeparator: " ",
                                            type: "user",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.reviewedAt",
                                        widget: "#DisplayCard",
                                        label: "reviewedAt",
                                        widgetProps: { icon: "#CalendarCheck", format: "dateTime" , type: "dateTime"},
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.materialsPlan.length",
                                        widget: "#DisplayCard",
                                        label: "materials",
                                        skipReadAccessGate: true,
                                        widgetProps: { icon: "#List" , type: "number"},
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.notes",
                                        widget: "#DisplayCard",
                                        label: "notesLabel",
                                        widgetProps: {
                                            icon: "#IconAlignLeft",
                                            expandable: true,
                                            maxLength: 250,
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.materialsPlan",
                                        widget: "#DisplayCard",
                                        label: "materials",
                                        widgetProps: {
                                            icon: "#List",
                                            bodyWidget: "#SheetModificationLineItems",
                                            variant: "materialsPlan",
                                            className: "text-sm",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "engineerApproval" },
                                    field: {
                                        name: "engineerApproval.media",
                                        widget: "#DisplayCard",
                                        label: "mediaLabel",
                                        widgetProps: {
                                            icon: "#Paperclip",
                                            type: "media",
                                        },
                                    },
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["ceoApproval"] },
            props: { title: "ceoApproval" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg border bg-amber-500/5 border-amber-500/20 space-y-2" },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "ceoApproval" },
                                    field: {
                                        name: "ceoApproval.decision",
                                        widget: "#DisplayCard",
                                        label: "decision",
                                        widgetProps: { icon: "#CircleDot", languageKeyCategory: "decisions", type: "enum" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "ceoApproval" },
                                    field: {
                                        name: "ceoApproval.user",
                                        widget: "#DisplayCard",
                                        label: "reviewedBy",
                                        widgetProps: {
                                            icon: "#User",
                                            parent: "ceoApproval.user",
                                            valuePath: ["name", "surname"],
                                            joinSeparator: " ",
                                            type: "user",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "ceoApproval" },
                                    field: {
                                        name: "ceoApproval.reviewedAt",
                                        widget: "#DisplayCard",
                                        label: "reviewedAt",
                                        widgetProps: { icon: "#CalendarCheck", format: "dateTime" , type: "dateTime"},
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "ceoApproval" },
                                    field: {
                                        name: "ceoApproval.notes",
                                        widget: "#DisplayCard",
                                        label: "notesLabel",
                                        widgetProps: {
                                            icon: "#IconAlignLeft",
                                            expandable: true,
                                            maxLength: 250,
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "ceoApproval" },
                                    dependent: "ceoApproval.media",
                                    field: {
                                        name: "ceoApproval.media",
                                        widget: "#DisplayCard",
                                        label: "mediaLabel",
                                        widgetProps: {
                                            icon: "#Paperclip",
                                            type: "media",
                                        },
                                    },
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["financeDetails"] },
            props: { title: "financeDetails" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg border bg-emerald-500/5 border-emerald-500/20 space-y-2" },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    field: {
                                        name: "financeDetails.totalCost",
                                        widget: "#DisplayCard",
                                        label: "totalCost",
                                        widgetProps: {
                                            icon: "#DollarSign",
                                            format: "locale",
                                            valuePath: ["financeDetails.currency.symbol", "financeDetails.totalCost"],
                                            joinSeparator: " ",
                                            linkedRefPath: "financeDetails.currency",
                                            linkedSheetModel: "currencies",
                                            linkedSheetWidget: "#CurrencySheetView",
                                            linkedSheetEntityProp: "currency",
                                            type: "currency",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    field: {
                                        name: "financeDetails.currency.name",
                                        widget: "#DisplayCard",
                                        label: "currency",
                                        widgetProps: {
                                            icon: "#Banknote",
                                            valuePath: ["financeDetails.currency.symbol", "financeDetails.currency.name"],
                                            joinSeparator: " ",
                                            linkedRefPath: "financeDetails.currency",
                                            linkedSheetModel: "currencies",
                                            linkedSheetWidget: "#CurrencySheetView",
                                            linkedSheetEntityProp: "currency",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    field: {
                                        name: "financeDetails.costBreakdown.length",
                                        widget: "#DisplayCard",
                                        label: "costBreakdown",
                                        skipReadAccessGate: true,
                                        widgetProps: { icon: "#ListOrdered" , type: "number"},
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    field: {
                                        name: "financeDetails.notes",
                                        widget: "#DisplayCard",
                                        label: "notesLabel",
                                        widgetProps: {
                                            icon: "#IconAlignLeft",
                                            expandable: true,
                                            maxLength: 250,
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    field: {
                                        name: "financeDetails.costBreakdown",
                                        widget: "#DisplayCard",
                                        label: "costBreakdown",
                                        widgetProps: {
                                            icon: "#ListOrdered",
                                            bodyWidget: "#SheetModificationLineItems",
                                            variant: "costBreakdown",
                                            currencyPath: "financeDetails.currency",
                                            totalPath: "financeDetails.totalCost",
                                            className: "text-sm",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    dependent: "financeDetails.media",
                                    field: {
                                        name: "financeDetails.media",
                                        widget: "#DisplayCard",
                                        label: "mediaLabel",
                                        widgetProps: {
                                            icon: "#Paperclip",
                                            type: "media",
                                        },
                                    },
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["clientCostApproval"] },
            props: { title: "clientCostApproval" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg border bg-teal-500/5 border-teal-500/20 space-y-2" },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "clientCostApproval" },
                                    field: {
                                        name: "clientCostApproval.decision",
                                        widget: "#DisplayCard",
                                        label: "decision",
                                        widgetProps: { icon: "#CircleDot", languageKeyCategory: "decisions", type: "enum" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "clientCostApproval" },
                                    field: {
                                        name: "clientCostApproval.user",
                                        widget: "#DisplayCard",
                                        label: "reviewedBy",
                                        widgetProps: {
                                            icon: "#User",
                                            parent: "clientCostApproval.user",
                                            valuePath: ["name", "surname"],
                                            joinSeparator: " ",
                                            type: "user",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "clientCostApproval" },
                                    field: {
                                        name: "clientCostApproval.reviewedAt",
                                        widget: "#DisplayCard",
                                        label: "reviewedAt",
                                        widgetProps: { icon: "#CalendarCheck", format: "dateTime" , type: "dateTime"},
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "clientCostApproval" },
                                    dependent: "clientCostApproval.notes",
                                    field: {
                                        name: "clientCostApproval.notes",
                                        widget: "#DisplayCard",
                                        label: "notesLabel",
                                        widgetProps: {
                                            icon: "#IconAlignLeft",
                                            expandable: true,
                                            maxLength: 250,
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["deliveryApproval"] },
            props: { title: "delivery" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg border bg-rose-500/5 border-rose-500/20 space-y-2" },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "deliveryApproval" },
                                    field: {
                                        name: "deliveryApproval.decision",
                                        widget: "#DisplayCard",
                                        label: "decision",
                                        widgetProps: { icon: "#CircleDot", languageKeyCategory: "decisions", type: "enum" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "deliveryApproval" },
                                    field: {
                                        name: "deliveryApproval.user",
                                        widget: "#DisplayCard",
                                        label: "reviewedBy",
                                        widgetProps: {
                                            icon: "#User",
                                            parent: "deliveryApproval.user",
                                            valuePath: ["name", "surname"],
                                            joinSeparator: " ",
                                            type: "user",
                                        },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "deliveryApproval" },
                                    field: {
                                        name: "deliveryApproval.reviewedAt",
                                        widget: "#DisplayCard",
                                        label: "reviewedAt",
                                        widgetProps: { icon: "#CalendarCheck", format: "dateTime" , type: "dateTime"},
                                    },
                                },
                            ], dependent: "cancellationReason",
                        },
                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "deliveryApproval" },
                                    dependent: "deliveryApproval.notes",
                                    field: {
                                        name: "deliveryApproval.notes",
                                        widget: "#DisplayCard",
                                        label: "notesLabel",
                                        widgetProps: {
                                            icon: "#IconAlignLeft",
                                            expandable: true,
                                            maxLength: 250,
                                        },
                                    },
                                },
                            ],
                        },

                        {
                            render: "#SheetGrid",
                            props: { columns: 1 },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "deliveryApproval" },
                                    dependent: "deliveryApproval.media",
                                    field: {
                                        name: "deliveryApproval.media",
                                        widget: "#DisplayCard",
                                        label: "mediaLabel",
                                        widgetProps: {
                                            icon: "#Paperclip",
                                            type: "media",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#ReferencesViewModeScope",
                            dependent: "deliveryApproval.inspections",
                            props: {
                                storageKey: "modificationRequest.sheet.deliveryApproval.inspections.listDisplay",
                                defaultMode: "compact",
                            },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    permissions: { readAny: ["deliveryApproval"] },
                                    props: {
                                        title: "inspections",
                                        titleActions: "#ReferencesViewModeToggle",
                                    },
                                    children: [
                                        {
                                            render: "#ReferencesRender",
                                            permissions: {
                                                read: "deliveryApproval",
                                            },
                                            field: {
                                                name: "deliveryApproval.inspections",
                                                widget: "#ReferencesRender",
                                                widgetProps: {
                                                    cardWidget: "#InspectionCard",
                                                    itemDataProp: "inspection",
                                                    hideActions: true,
                                                    pageSize: 3,
                                                    mediaUrl: "/api/auxiliary/media/",
                                                    listClassName: "gap-1",
                                                    compactRow: {
                                                        icon: "#ClipboardList",
                                                        label: "inspection",
                                                        valuePath: ["name"],
                                                        joinSeparator: " · ",
                                                        linkedSheetModel: "inspections",
                                                        linkedSheetWidget: "#InspectionSheetView",
                                                        linkedSheetEntityProp: "inspection",
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ], dependent: "cancellationReason",
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["notificationSent", "clientNotifiedAt"] },
            props: { title: "notifications" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "notificationSent" },
                            field: {
                                name: "notificationSent",
                                widget: "#DisplayCard",
                                label: "notificationSent",
                                widgetProps: { icon: "#Bell", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "clientNotifiedAt" },
                            field: {
                                name: "clientNotifiedAt",
                                widget: "#DisplayCard",
                                label: "clientNotifiedAt",
                                widgetProps: { icon: "#BellRing", format: "dateTime" , type: "dateTime"},
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["cancellationReason"] },
            props: { title: "cancellation" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "cancellationReason" },
                            field: {
                                name: "cancellationReason",
                                widget: "#DisplayCard",
                                label: "cancellationReason",
                                widgetProps: {
                                    icon: "#XCircle",
                                    expandable: true,
                                    maxLength: 250,
                                    variant: "destructive",
                                },
                            }, dependent: "cancellationReason",
                        },
                    ],
                },
            ], dependent: "cancellationReason",
        },
        lifecycleSheetGroup,
    ],
};

const modificationRequestCreateFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "unitSelection", skipRenderWhenFormExtraTruthy: "hideModificationUnitCascade" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "project",
                                cascadeClearFormFields: ["edifice", "floor", "unit"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "edifice",
                                postBodyFromFormField: { field: "project", paramName: "project" },
                                cascadeClearFormFields: ["floor", "unit"],
                                remountKeyFormField: "project",
                                enableWhenFormFieldsNonEmpty: ["project"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "floor",
                            widget: "#ApiSelect",
                            label: "form.floorLabel",
                            placeholder: "form.floorPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/floor/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "floor",
                                postBodyFromFormField: { field: "edifice", paramName: "edifice" },
                                cascadeClearFormFields: ["unit"],
                                remountKeyFormField: "edifice",
                                enableWhenFormFieldsNonEmpty: ["edifice"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unit",
                            widget: "#ApiSelect",
                            label: "form.unitLabel",
                            placeholder: "form.unitPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "unit",
                                postBodyFromFormFields: [
                                    {field: "edifice", paramName: "edifice"},
                                    {field: "floor", paramName: "floor"},
                                ],
                                remountKeyFormField: "edifice",
                                enableWhenFormFieldsNonEmpty: ["project", "edifice"],
                            },
                        },
                    }
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "requestedBy",
                            widget: "#ApiSelect",
                            label: "form.requestedByLabel",
                            placeholder: "form.requestedByPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: { administration: false },
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "constructionType",
                            widget: "#SimpleSelect",
                            label: "form.constructionTypeLabel",
                            placeholder: "form.constructionTypePlaceholder",
                            required: true,
                            widgetProps: {
                                options: [
                                    { value: "materials", label: "form.constructionTypeOption.materials" },
                                    { value: "room_division", label: "form.constructionTypeOption.room_division" },
                                    { value: "flooring", label: "form.constructionTypeOption.flooring" },
                                    { value: "utilities", label: "form.constructionTypeOption.utilities" },
                                    { value: "structural", label: "form.constructionTypeOption.structural" },
                                    { value: "electrical", label: "form.constructionTypeOption.electrical" },
                                    { value: "plumbing", label: "form.constructionTypeOption.plumbing" },
                                    { value: "hvac", label: "form.constructionTypeOption.hvac" },
                                    { value: "cosmetic", label: "form.constructionTypeOption.cosmetic" },
                                    { value: "other", label: "form.constructionTypeOption.other" },
                                ],
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "details" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 1 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: { maxLength: MODIFICATION_REQUEST_TITLE_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "description",
                            widget: "#Textarea",
                            label: "form.descriptionLabel",
                            placeholder: "form.descriptionPlaceholder",
                            required: true,
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto", maxLength: MODIFICATION_REQUEST_LONG_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "specifications",
                            widget: "#Textarea",
                            label: "form.specificationsLabel",
                            placeholder: "form.specificationsPlaceholder",
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto", maxLength: MODIFICATION_REQUEST_LONG_TEXT_MAX },
                        },
                    },
                ],
            },
        ],
    },
];

const modificationRequestEditFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "unitSelection", skipRenderWhenFormExtraTruthy: "hideModificationUnitCascade" },
        permissions: {
            readAny: ["unit"],
            writeAny: ["unit"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "project",
                                cascadeClearFormFields: ["edifice", "floor", "unit"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "edifice",
                                postBodyFromFormField: { field: "project", paramName: "project" },
                                cascadeClearFormFields: ["floor", "unit"],
                                remountKeyFormField: "project",
                                enableWhenFormFieldsNonEmpty: ["project"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "floor",
                            widget: "#ApiSelect",
                            label: "form.floorLabel",
                            placeholder: "form.floorPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/floor/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "floor",
                                postBodyFromFormField: { field: "edifice", paramName: "edifice" },
                                cascadeClearFormFields: ["unit"],
                                remountKeyFormField: "edifice",
                                enableWhenFormFieldsNonEmpty: ["edifice"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unit",
                            widget: "#ApiSelect",
                            label: "form.unitLabel",
                            placeholder: "form.unitPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "unit",
                                postBodyFromFormFields: [
                                    {field: "edifice", paramName: "edifice"},
                                    {field: "floor", paramName: "floor"},
                                ],
                                remountKeyFormField: "edifice",
                                enableWhenFormFieldsNonEmpty: ["project", "edifice"],
                            },
                        }, permissions: {read: "unit", write: "unit"},
                    }
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        permissions: {
            readAny: ["requestedBy", "constructionType"],
            writeAny: ["requestedBy", "constructionType"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "requestedBy",
                            widget: "#ApiSelect",
                            label: "form.requestedByLabel",
                            placeholder: "form.requestedByPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: { administration: false },
                            },
                        }, permissions: {read: "requestedBy", write: "requestedBy"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "constructionType",
                            widget: "#SimpleSelect",
                            label: "form.constructionTypeLabel",
                            placeholder: "form.constructionTypePlaceholder",
                            required: true,
                            widgetProps: {
                                options: [
                                    { value: "materials", label: "form.constructionTypeOption.materials" },
                                    { value: "room_division", label: "form.constructionTypeOption.room_division" },
                                    { value: "flooring", label: "form.constructionTypeOption.flooring" },
                                    { value: "utilities", label: "form.constructionTypeOption.utilities" },
                                    { value: "structural", label: "form.constructionTypeOption.structural" },
                                    { value: "electrical", label: "form.constructionTypeOption.electrical" },
                                    { value: "plumbing", label: "form.constructionTypeOption.plumbing" },
                                    { value: "hvac", label: "form.constructionTypeOption.hvac" },
                                    { value: "cosmetic", label: "form.constructionTypeOption.cosmetic" },
                                    { value: "other", label: "form.constructionTypeOption.other" },
                                ],
                            },
                        }, permissions: {read: "constructionType", write: "constructionType"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "details" },
        permissions: {
            readAny: ["title", "description", "specifications"],
            writeAny: ["title", "description", "specifications"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 1 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: { maxLength: MODIFICATION_REQUEST_TITLE_MAX },
                        }, permissions: {read: "title", write: "title"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "description",
                            widget: "#Textarea",
                            label: "form.descriptionLabel",
                            placeholder: "form.descriptionPlaceholder",
                            required: true,
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto", maxLength: MODIFICATION_REQUEST_LONG_TEXT_MAX },
                        }, permissions: {read: "description", write: "description"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "specifications",
                            widget: "#Textarea",
                            label: "form.specificationsLabel",
                            placeholder: "form.specificationsPlaceholder",
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto", maxLength: MODIFICATION_REQUEST_LONG_TEXT_MAX },
                        }, permissions: {read: "specifications", write: "specifications"},
                    },
                ],
            },
        ],
    },
];

export const modificationRequestCreateFormView: ViewConfig = {
    model: "modificationrequests",
    viewType: "form",
    viewMode: "create",
    accessModel: "modificationRequests",
    apiUrl: "/api/realEstate/unit/modificationRequest",
    method: "PUT",
    nodes: modificationRequestCreateFormNode,
};

export const modificationRequestEditFormView: ViewConfig = {
    model: "modificationrequests",
    viewType: "form",
    viewMode: "edit",
    accessModel: "modificationRequests",
    apiUrl: "/api/realEstate/unit/modificationRequest",
    method: "PATCH",
    nodes: modificationRequestEditFormNode,
};

export const modificationRequestViews: ViewConfig[] = [
    modificationRequestSheetView,
    modificationRequestCreateFormView,
    modificationRequestEditFormView,
];
