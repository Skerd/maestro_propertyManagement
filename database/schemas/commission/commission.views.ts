import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const commissionSheetView: ViewConfig = {
    model: "commissions",
    viewType: "sheet",
    accessModel: "commissions",
    apiUrl: "/api/realEstate/commission",
    header: {
        titleField: "basis",
        titleFieldLanguageCategory: "basisEnum",
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
                            render: "#SmallInfoCard",
                            dependent: "agent",
                            permissions: {read: "agent"},
                            field: {
                                name: "agent",
                                widget: "#SmallInfoCard",
                                label: "agent",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "agent",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " "
                                }
                            }
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "sourceType"},
                            field: {
                                name: "sourceType",
                                widget: "#SmallInfoCard",
                                label: "sourceType",
                                widgetProps: {
                                    icon: "#Tag",
                                    languageKeyCategory: "sourceTypeEnum"
                                }
                            }
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#SmallInfoCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statusEnum"
                                }
                            }
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "basis"},
                            field: {
                                name: "basis",
                                widget: "#SmallInfoCard",
                                label: "basis",
                                widgetProps: {
                                    icon: "#FileText",
                                    tooltip: "basisTooltip",
                                    languageKeyCategory: "basisEnum",
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
                            render: "#SmallInfoCard",
                            permissions: {read: "basisAmount"},
                            field: {
                                name: "basisAmount",
                                widget: "#SmallInfoCard",
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
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "ratePercent"},
                            field: {
                                name: "ratePercent",
                                widget: "#SmallInfoCard",
                                label: "ratePercent",
                                widgetProps: {icon: "#Percent", suffix: "%"}
                            }
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "amount"},
                            field: {
                                name: "amount",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            dependent: "sale",
                            permissions: {read: "sale"},
                            field: {
                                name: "sale.name",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            dependent: "reservation",
                            permissions: {read: "reservation"},
                            field: {
                                name: "reservation.name",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            dependent: "paidAt",
                            permissions: {read: "paidAt"},
                            field: {
                                name: "paidAt",
                                widget: "#SmallInfoCard",
                                label: "paidAt",
                                widgetProps: {icon: "#CalendarCheck", format: "date"}
                            }
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "voidedAt",
                            permissions: {read: "voidedAt"},
                            field: {
                                name: "voidedAt",
                                widget: "#SmallInfoCard",
                                label: "voidedAt",
                                widgetProps: {icon: "#XCircle", format: "date"}
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
        }
    ]
};

export const commissionViews: ViewConfig[] = [commissionSheetView];
