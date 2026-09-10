import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const commissionSheetView: ViewConfig = {
    model: "commissions",
    viewType: "sheet",
    accessModel: "commissions",
    apiUrl: "/api/realEstate/commission",
    header: {
        titleField: "agent.name",
        subtitleKey: "commission",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            permissions: {readAny: ["agent", "recordedByActionUser", "sourceType", "status", "basis", "notes"]},
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "agent"},
                            field: {
                                name: "agent",
                                widget: "#DisplayCard",
                                label: "agent",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "agent",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                }
                            }
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "sourceType"},
                            field: {
                                name: "sourceType",
                                widget: "#DisplayCard",
                                label: "sourceType",
                                widgetProps: {
                                    icon: "#Tag",
                                    languageKeyCategory: "fields.!enums.sourceType",
                                    type: "enum",
                                }
                            }
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#DisplayCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "fields.!enums.status",
                                    type: "enum",
                                }
                            }
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "basis"},
                            field: {
                                name: "basis",
                                widget: "#DisplayCard",
                                label: "basis",
                                widgetProps: {
                                    icon: "#FileText",
                                    tooltip: "basisTooltip",
                                    languageKeyCategory: "fields.!enums.basis",
                                    type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "recordedByActionUser"},
                            field: {
                                name: "recordedByActionUser",
                                widget: "#DisplayCard",
                                label: "recordedByActionUser",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "recordedByActionUser",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                    ]
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "notes"},
                            field: {
                                name: "notes",
                                widget: "#DisplayCard",
                                label: "notes",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
            ]
        },

        {
            render: "#SheetGroup",
            permissions: {readAny: ["basisAmount", "ratePercent", "amount"]},
            props: {title: "financials"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "basisAmount"},
                            field: {
                                name: "basisAmount",
                                widget: "#DisplayCard",
                                label: "basisAmount",
                                widgetProps: {
                                    icon: "#Calculator",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "basisAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "ratePercent"},
                            field: {
                                name: "ratePercent",
                                widget: "#DisplayCard",
                                label: "ratePercent",
                                widgetProps: {icon: "#Percent", suffix: "%"}
                            }
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "amount"},
                            field: {
                                name: "amount",
                                widget: "#DisplayCard",
                                label: "amount",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "amount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                    ]
                }
            ]
        },

        {
            render: "#SheetGroup",
            permissions: {readAny: ["sale", "reservation"]},
            props: {title: "references"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "sale"},
                            field: {
                                name: "sale.name",
                                widget: "#DisplayCard",
                                label: "sale",
                                widgetProps: {
                                    icon: "#ShoppingCart",
                                    linkedRefPath: "sale",
                                    linkedSheetModel: "sales",
                                    linkedSheetWidget: "#SaleSheetView",
                                    linkedSheetEntityProp: "sale",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "reservation"},
                            field: {
                                name: "reservation.name",
                                widget: "#DisplayCard",
                                label: "reservation",
                                widgetProps: {
                                    icon: "#BookMarked",
                                    linkedRefPath: "reservation",
                                    linkedSheetModel: "reservations",
                                    linkedSheetWidget: "#ReservationSheetView",
                                    linkedSheetEntityProp: "reservation",
                                },
                            },
                        },
                    ]
                }
            ]
        },

        {
            render: "#SheetGroup",
            permissions: {readAny: ["paidAt", "voidedAt", "paymentReference"]},
            props: {title: "dates"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paidAt"},
                            field: {
                                name: "paidAt",
                                widget: "#DisplayCard",
                                label: "paidAt",
                                widgetProps: {icon: "#CalendarCheck", format: "date", type: "date"}
                            }
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "voidedAt",
                            permissions: {read: "voidedAt"},
                            field: {
                                name: "voidedAt",
                                widget: "#DisplayCard",
                                label: "voidedAt",
                                widgetProps: {icon: "#XCircle", format: "date", type: "date"}
                            }
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "paymentReference",
                            permissions: {read: "paymentReference"},
                            field: {
                                name: "paymentReference",
                                widget: "#DisplayCard",
                                label: "paymentReference",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                    ]
                }
            ]
        },

        {
            render: "#SheetGroup",
            dependent: "paymentReceiptMediaId",
            permissions: {readAny: ["paymentReceiptMediaId"]},
            props: {title: "paymentReceiptMediaId"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: {read: "paymentReceiptMediaId"},
                            field: {
                                name: "paymentReceiptMediaId",
                                widget: "#SheetMediaFilesStrip",
                                widgetProps: {
                                    canDownload: true,
                                    canRemove: false,
                                    isBig: false,
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "commission.sheet.splits.listDisplay",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    dependent: "splits",
                    permissions: {readAny: ["splits"]},
                    props: {
                        title: "splits",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: {read: "splits"},
                                    field: {
                                        name: "splits",
                                        widget: "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 5,
                                            compactSummaryFields: ["agent", "label", "ratePercent", "amount"],
                                            fields: [
                                                {
                                                    name: "agent",
                                                    type: "text",
                                                    valuePath: ["name", "surname"],
                                                    joinSeparator: " ",
                                                    className: "text-sm font-medium",
                                                    labelKey: "splitAgent",
                                                },
                                                {
                                                    name: "label",
                                                    type: "text",
                                                    className: "text-sm text-muted-foreground",
                                                    labelKey: "splitLabel",
                                                },
                                                {
                                                    name: "ratePercent",
                                                    type: "text",
                                                    className: "text-sm",
                                                    labelKey: "ratePercent",
                                                },
                                                {
                                                    name: "amount",
                                                    type: "text",
                                                    className: "text-sm",
                                                    labelKey: "amount",
                                                },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },

        lifecycleSheetGroup,
    ]
};

export const commissionViews: ViewConfig[] = [commissionSheetView];
