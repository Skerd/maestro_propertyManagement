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
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "agent",
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
                                    languageKeyCategory: "basisEnum",
                                    type: "enum",
                                },
                            },
                        },
                    ]
                }
            ]
        },

        {
            render: "#SheetGroup",
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
            props: {title: "references"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "sale",
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
                            dependent: "reservation",
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
            props: {title: "dates"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "paidAt",
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
                        }
                    ]
                }
            ]
        },

        {
            render: "#SheetGroup",
            dependent: "notes",
            props: {title: "notes"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "notes"},
                            field: {
                                name: "notes",
                                widget: "#ExpandableText",
                                widgetProps: {className: "text-sm"}
                            }
                        }
                    ]
                }
            ]
        },
        lifecycleSheetGroup,
    ]
};

export const commissionViews: ViewConfig[] = [commissionSheetView];
