import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
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
            props: { title: "overview" },
            children: [
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
                            permissions: { read: "title" },
                            field: {
                                name: "title",
                                widget: "#DisplayCard",
                                label: "title",
                                widgetProps: { icon: "#Type" },
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
                            dependent: "unit",
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
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "dates" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
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
            props: { title: "description" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "description" },
                            field: {
                                name: "description",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "specifications" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "specifications" },
                            field: {
                                name: "specifications",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            dependent: "architectApproval",
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
                                    permissions: { read: "architectApproval.decision" },
                                    field: {
                                        name: "architectApproval.decision",
                                        widget: "#DisplayCard",
                                        label: "decision",
                                        widgetProps: { icon: "#CircleDot", languageKeyCategory: "decisions", type: "enum" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "architectApproval.user" },
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
                                    permissions: { read: "architectApproval.reviewedAt" },
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
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "notesLabel" },
                                    children: [
                                        {
                                            render: "#ExpandableText",
                                            permissions: { read: "architectApproval.notes" },
                                            field: {
                                                name: "architectApproval.notes",
                                                widget: "#ExpandableText",
                                                widgetProps: { className: "text-sm" },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "mediaLabel" },
                                    children: [
                                        {
                                            render: "#SheetMediaFilesStrip",
                                            permissions: { read: "architectApproval.media" },
                                            field: {
                                                name: "architectApproval.media",
                                                widget: "#SheetMediaFilesStrip",
                                                widgetProps: {
                                                    combineFromFields: ["architectApproval.media"],
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
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
                                    permissions: { read: "engineerApproval.materialsPlan" },
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
                            render: "div",
                            dependent: "engineerApproval.materialsPlan",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "materials" },
                                    children: [
                                        {
                                            render: "#SheetModificationLineItems",
                                            permissions: { read: "engineerApproval.materialsPlan" },
                                            field: {
                                                name: "engineerApproval.materialsPlan",
                                                widget: "#SheetModificationLineItems",
                                                widgetProps: {
                                                    variant: "materialsPlan",
                                                    className: "text-sm",
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "notesLabel" },
                                    children: [
                                        {
                                            render: "#ExpandableText",
                                            permissions: { read: "engineerApproval" },
                                            field: {
                                                name: "engineerApproval.notes",
                                                widget: "#ExpandableText",
                                                widgetProps: { className: "text-sm" },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "mediaLabel" },
                                    children: [
                                        {
                                            render: "#SheetMediaFilesStrip",
                                            permissions: { read: "engineerApproval.media" },
                                            field: {
                                                name: "engineerApproval.media",
                                                widget: "#SheetMediaFilesStrip",
                                                widgetProps: {
                                                    combineFromFields: ["engineerApproval.media"],
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
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
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "notesLabel" },
                                    children: [
                                        {
                                            render: "#ExpandableText",
                                            permissions: { read: "ceoApproval" },
                                            field: {
                                                name: "ceoApproval.notes",
                                                widget: "#ExpandableText",
                                                widgetProps: { className: "text-sm" },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "mediaLabel" },
                                    children: [
                                        {
                                            render: "#SheetMediaFilesStrip",
                                            permissions: { read: "ceoApproval.media" },
                                            field: {
                                                name: "ceoApproval.media",
                                                widget: "#SheetMediaFilesStrip",
                                                widgetProps: {
                                                    combineFromFields: ["ceoApproval.media"],
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
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
                                        widgetProps: { icon: "#DollarSign", format: "locale" , type: "currency"},
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails" },
                                    field: {
                                        name: "financeDetails.currency.name",
                                        widget: "#DisplayCard",
                                        label: "currency",
                                        widgetProps: { icon: "#Banknote" },
                                    },
                                },
                                {
                                    render: "#DisplayCard",
                                    permissions: { read: "financeDetails.costBreakdown" },
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
                            render: "div",
                            dependent: "financeDetails.costBreakdown",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "costBreakdown" },
                                    children: [
                                        {
                                            render: "#SheetModificationLineItems",
                                            permissions: { read: "financeDetails.costBreakdown" },
                                            field: {
                                                name: "financeDetails.costBreakdown",
                                                widget: "#SheetModificationLineItems",
                                                widgetProps: {
                                                    variant: "costBreakdown",
                                                    currencyPath: "financeDetails.currency",
                                                    totalPath: "financeDetails.totalCost",
                                                    className: "text-sm",
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "notesLabel" },
                                    children: [
                                        {
                                            render: "#ExpandableText",
                                            permissions: { read: "financeDetails" },
                                            field: {
                                                name: "financeDetails.notes",
                                                widget: "#ExpandableText",
                                                widgetProps: { className: "text-sm" },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "mediaLabel" },
                                    children: [
                                        {
                                            render: "#SheetMediaFilesStrip",
                                            permissions: { read: "financeDetails.media" },
                                            field: {
                                                name: "financeDetails.media",
                                                widget: "#SheetMediaFilesStrip",
                                                widgetProps: {
                                                    combineFromFields: ["financeDetails.media"],
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
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
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "notesLabel" },
                                    children: [
                                        {
                                            render: "#ExpandableText",
                                            permissions: { read: "deliveryApproval" },
                                            field: {
                                                name: "deliveryApproval.notes",
                                                widget: "#ExpandableText",
                                                widgetProps: { className: "text-sm" },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },

                        {
                            render: "#ReferencesViewModeScope",
                            props: {
                                storageKey: "modificationRequest.sheet.deliveryApproval.inspections.listDisplay",
                                defaultMode: "compact",
                            },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: {
                                        title: "inspections",
                                        titleActions: "#ReferencesViewModeToggle",
                                    },
                                    children: [
                                        {
                                            render: "div",
                                            props: {
                                                className: "p-4 rounded-lg bg-muted/30 border border-border/50",
                                            },
                                            children: [
                                                {
                                                    render: "#ReferencesRender",
                                                    permissions: {
                                                        read: "deliveryApproval.inspections",
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
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-background/60 border border-border/40" },
                            children: [
                                {
                                    render: "#SheetGroup",
                                    props: { title: "mediaLabel" },
                                    children: [
                                        {
                                            render: "#SheetMediaFilesStrip",
                                            permissions: { read: "deliveryApproval.media" },
                                            field: {
                                                name: "deliveryApproval.media",
                                                widget: "#SheetMediaFilesStrip",
                                                widgetProps: {
                                                    combineFromFields: ["deliveryApproval.media"],
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        }
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
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
            dependent: "cancellationReason",
            permissions: { read: "cancellationReason" },
            props: { title: "cancellation" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-red-500/10 border border-red-500/20" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "cancellationReason" },
                            field: {
                                name: "cancellationReason",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm text-red-600 dark:text-red-400" },
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const modificationRequestFormFields: ViewConfig["nodes"] = [
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
                            widgetProps: { maxLength: 255 },
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
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "specifications",
                            widget: "#Textarea",
                            label: "form.specificationsLabel",
                            placeholder: "form.specificationsPlaceholder",
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                        },
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
    nodes: modificationRequestFormFields,
};

export const modificationRequestEditFormView: ViewConfig = {
    model: "modificationrequests",
    viewType: "form",
    viewMode: "edit",
    accessModel: "modificationRequests",
    apiUrl: "/api/realEstate/unit/modificationRequest",
    method: "PATCH",
    nodes: modificationRequestFormFields,
};

export const modificationRequestViews: ViewConfig[] = [
    modificationRequestSheetView,
    modificationRequestCreateFormView,
    modificationRequestEditFormView,
];
