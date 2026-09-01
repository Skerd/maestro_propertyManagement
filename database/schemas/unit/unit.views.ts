import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {UNIT_ORIENTATION_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";
import {
    UNIT_LONG_TEXT_MAX,
    UNIT_NUMBER_MAX,
    UNIT_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const orientationOptions = UNIT_ORIENTATION_VALUES.map((value) => ({
    value,
    label: `form.orientation${value}`,
}));

const constructionStatusOptions = [
    {value: "planned", label: "form.constructionStatusPlanned"},
    {value: "under_construction", label: "form.constructionStatusUnderConstruction"},
    {value: "ready", label: "form.constructionStatusReady"},
    {value: "delivered", label: "form.constructionStatusDelivered"},
];

export const unitSheetView: ViewConfig = {
    model: "units",
    viewType: "sheet",
    accessModel: "units",
    apiUrl: "/api/realEstate/unit",
    header: {
        titleField: "name",
        subtitleKey: "unit",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            permissions: {
                readAny: [
                    "name",
                    "unitNumber",
                    "status",
                    "featuredOnHomepage",
                    "floor",
                    "unitType",
                    "description",
                ],
            },
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
                            permissions: { read: "unitNumber" },
                            field: {
                                name: "unitNumber",
                                widget: "#DisplayCard",
                                label: "unitNumber",
                                widgetProps: { icon: "#Hash" },
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
                                    languageKeyCategory: "unitStatusEnum", type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "featuredOnHomepage" },
                            field: {
                                name: "featuredOnHomepage",
                                widget: "#DisplayCard",
                                label: "featuredOnHomepage",
                                widgetProps: {
                                    icon: "#BookMarked",
                                    tooltip: "featuredOnHomepageTooltip",
                                    type: "boolean",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "project.name",
                                widget: "#DisplayCard",
                                label: "project",
                                skipReadAccessGate: true,
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "edifice.name",
                                widget: "#DisplayCard",
                                label: "edifice",
                                skipReadAccessGate: true,
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "edifice",
                                    linkedSheetModel: "edifices",
                                    linkedSheetWidget: "#EdificeSheetView",
                                    linkedSheetEntityProp: "edifice",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "floor" },
                            field: {
                                name: "floor.name",
                                widget: "#DisplayCard",
                                label: "floor",
                                widgetProps: {
                                    icon: "#Layers",
                                    linkedRefPath: "floor",
                                    linkedSheetModel: "floors",
                                    linkedSheetWidget: "#FloorSheetView",
                                    linkedSheetEntityProp: "floor",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "unitType" },
                            field: {
                                name: "unitType.name",
                                widget: "#DisplayCard",
                                label: "unitType",
                                widgetProps: {
                                    icon: "#LayoutGrid",
                                    linkedRefPath: "unitType",
                                    linkedSheetModel: "unitTypes",
                                    linkedSheetWidget: "#UnitTypeSheetView",
                                    linkedSheetEntityProp: "unitType",
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
            ],
        },

        {
            render: "#SheetGroup",
            permissions: {
                readAny: [
                    "area",
                    "sharedArea",
                    "netArea",
                    "verandaArea",
                    "price",
                    "numberOfRooms",
                    "numberOfBathrooms",
                ],
            },
            props: { title: "areaAndPricing" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "area" },
                            field: {
                                name: "area",
                                widget: "#DisplayCard",
                                label: "area",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" , type: "area"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "sharedArea" },
                            field: {
                                name: "sharedArea",
                                widget: "#DisplayCard",
                                label: "sharedArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" , type: "area"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "netArea" },
                            field: {
                                name: "netArea",
                                widget: "#DisplayCard",
                                label: "netArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" , type: "area"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "verandaArea" },
                            field: {
                                name: "verandaArea",
                                widget: "#DisplayCard",
                                label: "verandaArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" , type: "area"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "price" },
                            field: {
                                name: "price",
                                widget: "#DisplayCard",
                                label: "price",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["priceCurrency.symbol", "price"],
                                    joinSeparator: " ",
                                    linkedRefPath: "priceCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfRooms" },
                            field: {
                                name: "numberOfRooms",
                                widget: "#DisplayCard",
                                label: "numberOfRooms",
                                widgetProps: { icon: "#BedDouble" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfBathrooms" },
                            field: {
                                name: "numberOfBathrooms",
                                widget: "#DisplayCard",
                                label: "numberOfBathrooms",
                                widgetProps: { icon: "#Bath" , type: "number"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            permissions: { readAny: ["orientation", "constructionStatus"] },
            props: { title: "layoutAndConstruction" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "orientation" },
                            field: {
                                name: "orientation",
                                widget: "#DisplayCard",
                                label: "orientation",
                                widgetProps: {
                                    icon: "#Compass",
                                    languageKeyCategory: "unitOrientationEnum", type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "constructionStatus" },
                            field: {
                                name: "constructionStatus",
                                widget: "#DisplayCard",
                                label: "constructionStatus",
                                widgetProps: {
                                    icon: "#Hammer",
                                    languageKeyCategory: "unitConstructionStatusEnum", type: "enum",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            dependentAny: ["statistics"],
            dependentRuntimeOnly: true,
            props: { title: "statisticsTitle" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.collectedAmount",
                                        widget: "#DisplayCard",
                                        label: "statistics.collectedAmount",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.collectedAmountTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            type: "currency",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.notCollectedAmount",
                                        widget: "#DisplayCard",
                                        label: "statistics.notCollectedAmount",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.notCollectedAmountTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            type: "currency",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.averagePricePerSquareMeter",
                                        widget: "#DisplayCard",
                                        label: "statistics.averagePricePerSquareMeter",
                                        widgetProps: {
                                            icon: "#IconGrid4x4",
                                            tooltip: "statistics.averagePricePerSquareMeterTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            suffix: "/m²",
                                            type: "currency",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.verifiedPaidUnitCosts",
                                        widget: "#DisplayCard",
                                        label: "statistics.verifiedPaidUnitCosts",
                                        widgetProps: {
                                            icon: "#Receipt",
                                            tooltip: "statistics.verifiedPaidUnitCostsTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            type: "currency",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.verifiedOutstandingUnitCosts",
                                        widget: "#DisplayCard",
                                        label: "statistics.verifiedOutstandingUnitCosts",
                                        widgetProps: {
                                            icon: "#Receipt",
                                            tooltip: "statistics.verifiedOutstandingUnitCostsTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            type: "currency",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.pendingVerificationUnitCosts",
                                        widget: "#DisplayCard",
                                        label: "statistics.pendingVerificationUnitCosts",
                                        widgetProps: {
                                            icon: "#Receipt",
                                            tooltip: "statistics.pendingVerificationUnitCostsTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            type: "currency",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.unitCostDocumentCount",
                                widget: "#DisplayCard",
                                label: "statistics.unitCostDocumentCount",
                                widgetProps: {
                                    icon: "#FileStack",
                                    tooltip: "statistics.unitCostDocumentCountTooltip",
                                    format: "locale",
                                    type: "number",
                                     show: true,
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
                readAny: [
                    "hasBalcony",
                    "hasTerrace",
                    "hasSeaView",
                    "hasCityView",
                    "hasLakeView",
                    "hasElevator",
                ],
            },
            props: { title: "features" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasBalcony" },
                            field: {
                                name: "hasBalcony",
                                widget: "#DisplayCard",
                                label: "hasBalcony",
                                widgetProps: { icon: "#Fence", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasTerrace" },
                            field: {
                                name: "hasTerrace",
                                widget: "#DisplayCard",
                                label: "hasTerrace",
                                widgetProps: { icon: "#TreePine", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasSeaView" },
                            field: {
                                name: "hasSeaView",
                                widget: "#DisplayCard",
                                label: "hasSeaView",
                                widgetProps: { icon: "#Waves", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasCityView" },
                            field: {
                                name: "hasCityView",
                                widget: "#DisplayCard",
                                label: "hasCityView",
                                widgetProps: { icon: "#Building", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasLakeView" },
                            field: {
                                name: "hasLakeView",
                                widget: "#DisplayCard",
                                label: "hasLakeView",
                                widgetProps: { icon: "#Droplets", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasElevator" },
                            field: {
                                name: "hasElevator",
                                widget: "#DisplayCard",
                                label: "hasElevator",
                                widgetProps: { icon: "#ArrowUpDown", valueType: "boolean" , type: "boolean"},
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: {
                readAny: ["saleCommissionRatePercent", "reservationCommissionRatePercent"],
            },
            props: { title: "commissions" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "saleCommissionRatePercent" },
                            field: {
                                name: "saleCommissionRatePercent",
                                widget: "#DisplayCard",
                                label: "saleCommission",
                                widgetProps: { icon: "#Percent", suffix: "%" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "reservationCommissionRatePercent" },
                            field: {
                                name: "reservationCommissionRatePercent",
                                widget: "#DisplayCard",
                                label: "reservationCommission",
                                widgetProps: { icon: "#Percent", suffix: "%" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.inspections.listDisplay",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["inspections"] },
                    props: {
                        title: "inspections",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "inspections" },
                                    field: {
                                        name: "inspections",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#InspectionCard",
                                            pageSize: 2,
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.costs.listDisplay",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["costs"] },
                    props: {
                        title: "unitCosts",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "costs" },
                                    field: {
                                        name: "costs",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#UnitCostCard",
                                            pageSize: 2,
                                            compactRow: {
                                                icon: "#Receipt",
                                                label: "unitCost",
                                                valuePath: ["name"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "unitCosts",
                                                linkedSheetWidget: "#UnitCostSheetView",
                                                linkedSheetEntityProp: "unitCost",
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.modificationRequests.listDisplay",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["modificationRequests"] },
                    props: {
                        title: "modificationRequests",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "modificationRequests" },
                                    field: {
                                        name: "modificationRequests",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#ModificationRequestCard",
                                            pageSize: 2,
                                            small: true,
                                            compactRow: {
                                                icon: "#Hammer",
                                                label: "modificationRequest",
                                                valuePath: ["name"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "modificationRequests",
                                                linkedSheetWidget: "#ModificationRequestSheetView",
                                                linkedSheetEntityProp: "request",
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.connectedUnits.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["connectedUnits"] },
                    props: {
                        title: "connectedUnits",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "connectedUnits" },
                                    field: {
                                        name: "connectedUnits",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#UnitCard",
                                            pageSize: 5,
                                            compactRow: {
                                                icon: "#Link",
                                                label: "unit",
                                                valuePath: ["name", "unitNumber"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "units",
                                                linkedSheetWidget: "#UnitSheetView",
                                                linkedSheetEntityProp: "unit",
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.sale.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["sale"] },
                    props: {
                        title: "sale",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "sale" },
                                    field: {
                                        name: "sale",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#SaleCard",
                                            pageSize: 1,
                                            small: true,
                                            compactRow: {
                                                icon: "#ShoppingCart",
                                                label: "sale",
                                                valuePath: ["name"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "sales",
                                                linkedSheetWidget: "#SaleSheetView",
                                                linkedSheetEntityProp: "sale",
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.reservation.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["reservation"] },
                    props: {
                        title: "reservation",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "reservation" },
                                    field: {
                                        name: "reservation",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#ReservationCard",
                                            pageSize: 1,
                                            small: true,
                                            compactRow: {
                                                icon: "#BookMarked",
                                                label: "reservation",
                                                valuePath: ["name"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "reservations",
                                                linkedSheetWidget: "#ReservationSheetView",
                                                linkedSheetEntityProp: "reservation",
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
            render: "#SheetGroup",
            permissions: { readAny: ["priceHistory"] },
            props: { title: "priceHistoryTitle" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#SheetPriceHistoryChart",
                            permissions: { read: "priceHistory" },
                            field: {
                                name: "priceHistory",
                                widget: "#SheetPriceHistoryChart",
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            permissions: { readAny: ["mainImage", "imageGallery", "videoGallery"] },
            props: { title: "gallery" },
            children: [
                {
                    render: "div",
                    props: { className: "max-w-full" },
                    children: [
                        {
                            render: "#GalleryCarousel",
                            field: {
                                name: "mainImage",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "imageGallery",
                                    videoGalleryField: "videoGallery",
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: false,
                                    showPreviews: true,
                                    previewLocation: "right",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        // ── Media Files ──────────────────────────────────────────────
        {
            render: "#SheetGroup",
            permissions: { readAny: ["mediaFiles"] },
            props: { title: "mediaFiles" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: { read: "mediaFiles" },
                            field: {
                                name: "mediaFiles",
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

        // ── Marketing Booklet ────────────────────────────────────────
        {
            render: "#SheetGroup",
            permissions: { readAny: ["marketingBooklet"] },
            props: { title: "marketingBooklet" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: { read: "marketingBooklet" },
                            field: {
                                name: "marketingBooklet",
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
        lifecycleSheetGroup,
    ],
};

const unitCreateFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
              render: "#FormGrid",
              props: { columns: 3 },
              children: [
                  {
                      render: "#Field",
                      props: { skipRenderWhenFormExtraTruthy: "hasRouteFloorId" },
                      field: {
                          name: "project",
                          widget: "#ApiSelect",
                          label: "form.projectLabel",
                          placeholder: "form.projectPlaceholder",
                          skipWriteAccessGate: true,
                          widgetProps: {
                              apiUrl: "/api/realEstate/project/select",
                              pageSize: 50,
                              cascadeClearFormFields: ["edifice"],
                          },
                      },
                  },
                  {
                      render: "#Field",
                      props: { skipRenderWhenFormExtraTruthy: "hasRouteFloorId" },
                      field: {
                          name: "edifice",
                          widget: "#ApiSelect",
                          label: "form.edificeLabel",
                          placeholder: "form.edificePlaceholder",
                          skipWriteAccessGate: true,
                          widgetProps: {
                              apiUrl: "/api/realEstate/edifice/select",
                              pageSize: 50,
                              postBodyFromFormField: { field: "project", paramName: "project" },
                              remountKeyFormField: "project",
                              cascadeClearFormFields: ["floor"],
                          },
                      },
                  },
                  {
                      render: "#Field",
                      props: { skipRenderWhenFormExtraTruthy: "hasRouteFloorId" },
                      field: {
                          name: "floor",
                          widget: "#ApiSelect",
                          label: "form.floorLabel",
                          placeholder: "form.floorPlaceholder",
                          widgetProps: {
                              apiUrl: "/api/realEstate/floor/select",
                              pageSize: 50,
                              postBodyFromFormField: { field: "edifice", paramName: "edifice" },
                              remountKeyFormField: "project",
                          },
                      },
                  },
              ]
            },
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: { maxLength: UNIT_SHORT_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unitNumber",
                            widget: "#Input",
                            label: "form.unitNumberLabel",
                            placeholder: "form.unitNumberPlaceholder",
                            required: true,
                            widgetProps: { maxLength: UNIT_NUMBER_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unitType",
                            widget: "#ApiSelect",
                            label: "form.unitTypeLabel",
                            placeholder: "form.unitTypePlaceholder",
                            required: true,
                            widgetProps: { apiUrl: "/api/realEstate/unitType/select" },
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
                    widgetProps: {
                        className: "resize-none max-h-[250px] overflow-y-auto",
                        maxLength: UNIT_LONG_TEXT_MAX,
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "rooms" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfRooms",
                            widget: "#Input",
                            label: "form.numberOfRoomsLabel",
                            placeholder: "form.numberOfRoomsPlaceholder",
                            required: true,
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfBathrooms",
                            widget: "#Input",
                            label: "form.numberOfBathroomsLabel",
                            placeholder: "form.numberOfBathroomsPlaceholder",
                            required: true,
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "areaAndPricing" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "area",
                            widget: "#Input",
                            label: "form.areaLabel",
                            placeholder: "form.areaPlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "sharedArea",
                            widget: "#Input",
                            label: "form.sharedAreaLabel",
                            placeholder: "form.sharedAreaPlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "netArea",
                            widget: "#Input",
                            label: "form.netAreaLabel",
                            placeholder: "form.netAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "verandaArea",
                            widget: "#Input",
                            label: "form.verandaAreaLabel",
                            placeholder: "form.verandaAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "price",
                            widget: "#Input",
                            label: "form.priceLabel",
                            placeholder: "form.pricePlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "priceCurrency",
                            widget: "#ApiSelect",
                            label: "form.priceCurrencyLabel",
                            placeholder: "form.priceCurrencyPlaceholder",
                            required: true,
                            widgetProps: { apiUrl: "/api/finance/currency/select" },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "layoutAndConstruction" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "orientation",
                            widget: "#SimpleSelect",
                            label: "form.orientationLabel",
                            placeholder: "form.orientationPlaceholder",
                            widgetProps: { options: orientationOptions, className: "grow w-full" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "constructionStatus",
                            widget: "#SimpleSelect",
                            label: "form.constructionStatusLabel",
                            placeholder: "form.constructionStatusPlaceholder",
                            widgetProps: { options: constructionStatusOptions, className: "grow w-full" },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "features" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4 },
                children: [
                    // {
                    //     render: "#Field",
                    //     field: { name: "isAvailable", widget: "#Switch", label: "form.isAvailableLabel" },
                    // },
                    {
                        render: "#Field",
                        field: { name: "hasBalcony", widget: "#Switch", label: "form.hasBalconyLabel" },
                    },
                    {
                        render: "#Field",
                        field: { name: "hasTerrace", widget: "#Switch", label: "form.hasTerraceLabel" },
                    },
                    {
                        render: "#Field",
                        field: { name: "hasSeaView", widget: "#Switch", label: "form.hasSeaViewLabel" },
                    },
                    {
                        render: "#Field",
                        field: { name: "hasCityView", widget: "#Switch", label: "form.hasCityViewLabel" },
                    },
                    {
                        render: "#Field",
                        field: { name: "hasLakeView", widget: "#Switch", label: "form.hasLakeViewLabel" },
                    },
                    {
                        render: "#Field",
                        field: { name: "hasElevator", widget: "#Switch", label: "form.hasElevatorLabel" },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "homepageFeatured" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "featuredOnHomepage",
                            widget: "#Switch",
                            label: "form.featuredOnHomepageLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "featuredSortOrder",
                            widget: "#Input",
                            label: "form.featuredSortOrderLabel",
                            placeholder: "form.featuredSortOrderPlaceholder",
                            widgetProps: { type: "number", min: 0, step: 1 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "commissions" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "saleCommissionRatePercent",
                            widget: "#Input",
                            label: "form.saleCommissionRateLabel",
                            placeholder: "form.saleCommissionRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: 0.1 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reservationCommissionRatePercent",
                            widget: "#Input",
                            label: "form.reservationCommissionRateLabel",
                            placeholder: "form.reservationCommissionRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: 0.1 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "connectedUnits" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "connectedUnits",
                    label: "form.connectedUnitsLabel",
                    placeholder: "form.addConnectedUnitPlaceholder",
                    widget: "#ApiSelect",
                    widgetProps: {
                        apiUrl: "/api/realEstate/unit/select",
                        multiple: true,
                        showSelectedChips: true,
                        postBodyFromFormFields: [
                            { field: "project", paramName: "project" },
                            { field: "edifice", paramName: "edifice" },
                        ],
                        enableWhenFormFieldsNonEmpty: ["project", "edifice"],
                        postBodyFormExtrasMerge: { notId: "unitId", notConnected: true },
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "unitLocation" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "__unitPolygon",
                    widget: "#FormUnitPolygon",
                    widgetProps: {
                        floorField: "floor",
                        polygonField: "polygonCoordinates",
                        closedField: "polygonClosed",
                        projectField: "project",
                        edificeField: "edifice",
                        hintKey: "selectUnitLocation",
                        errorLoadingKey: "errorLoadingFloor",
                        noImageKey: "floorNoMainImage",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "form.mainImageLabel" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "mainImage",
                    widget: "#MediaField",
                    label: "form.mainImageLabel",
                    widgetProps: { mediaType: "image", mode: "single" },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "form.imageGalleryLabel" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "imageGallery",
                    widget: "#MediaField",
                    label: "form.imageGalleryLabel",
                    widgetProps: { mediaType: "image", mode: "multiple", maxCount: 10 },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "form.videoGalleryLabel" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "videoGallery",
                    widget: "#MediaField",
                    label: "form.videoGalleryLabel",
                    widgetProps: { mediaType: "video", mode: "multiple", maxCount: 3 },
                },
            },
        ],
    },

    // ── Media files (generic file attachments) ──────────────────
    {
        render: "#TitleWithCollapse",
        props: { title: "form.mediaFilesLabel" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "mediaFiles",
                    widget: "#MediaField",
                    label: "form.mediaFilesLabel",
                    widgetProps: { mediaType: "file", mode: "multiple", maxCount: 20 },
                },
            },
        ],
    },

    // ── Marketing Booklet (single PDF) ──────────────────────────
    {
        render: "#TitleWithCollapse",
        props: { title: "form.marketingBookletLabel" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "marketingBooklet",
                    widget: "#MediaField",
                    label: "form.marketingBookletLabel",
                    widgetProps: { mediaType: "file", mode: "single", maxCount: 1, accept: "application/pdf,.pdf" },
                },
            },
        ],
    },
];

const unitEditFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        permissions: {
            readAny: ["project", "edifice", "floor", "name", "unitNumber", "unitType", "description"],
            writeAny: ["project", "edifice", "floor", "name", "unitNumber", "unitType", "description"],
        },
        children: [
            {
              render: "#FormGrid",
              props: { columns: 3 },
              children: [
                  {
                      render: "#Field",
                      props: { skipRenderWhenFormExtraTruthy: "hasRouteFloorId" },
                      field: {
                          name: "project",
                          widget: "#ApiSelect",
                          label: "form.projectLabel",
                          placeholder: "form.projectPlaceholder",
                          skipWriteAccessGate: true,
                          widgetProps: {
                              apiUrl: "/api/realEstate/project/select",
                              pageSize: 50,
                              cascadeClearFormFields: ["edifice"],
                          },
                      }, permissions: {read: "project"},
                  },
                  {
                      render: "#Field",
                      props: { skipRenderWhenFormExtraTruthy: "hasRouteFloorId" },
                      field: {
                          name: "edifice",
                          widget: "#ApiSelect",
                          label: "form.edificeLabel",
                          placeholder: "form.edificePlaceholder",
                          skipWriteAccessGate: true,
                          widgetProps: {
                              apiUrl: "/api/realEstate/edifice/select",
                              pageSize: 50,
                              postBodyFromFormField: { field: "project", paramName: "project" },
                              remountKeyFormField: "project",
                              cascadeClearFormFields: ["floor"],
                          },
                      }, permissions: {read: "edifice"},
                  },
                  {
                      render: "#Field",
                      props: { skipRenderWhenFormExtraTruthy: "hasRouteFloorId" },
                      field: {
                          name: "floor",
                          widget: "#ApiSelect",
                          label: "form.floorLabel",
                          placeholder: "form.floorPlaceholder",
                          widgetProps: {
                              apiUrl: "/api/realEstate/floor/select",
                              pageSize: 50,
                              postBodyFromFormField: { field: "edifice", paramName: "edifice" },
                              remountKeyFormField: "project",
                          },
                      }, permissions: {read: "floor", write: "floor"},
                  },
              ]
            },
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: { maxLength: UNIT_SHORT_TEXT_MAX },
                        }, permissions: {read: "name", write: "name"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unitNumber",
                            widget: "#Input",
                            label: "form.unitNumberLabel",
                            placeholder: "form.unitNumberPlaceholder",
                            required: true,
                            widgetProps: { maxLength: UNIT_NUMBER_MAX },
                        }, permissions: {read: "unitNumber", write: "unitNumber"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unitType",
                            widget: "#ApiSelect",
                            label: "form.unitTypeLabel",
                            placeholder: "form.unitTypePlaceholder",
                            required: true,
                            widgetProps: { apiUrl: "/api/realEstate/unitType/select" },
                        }, permissions: {read: "unitType", write: "unitType"},
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
                    widgetProps: {
                        className: "resize-none max-h-[250px] overflow-y-auto",
                        maxLength: UNIT_LONG_TEXT_MAX,
                    },
                }, permissions: {read: "description", write: "description"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "rooms" },
        permissions: {
            readAny: ["numberOfRooms", "numberOfBathrooms"],
            writeAny: ["numberOfRooms", "numberOfBathrooms"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfRooms",
                            widget: "#Input",
                            label: "form.numberOfRoomsLabel",
                            placeholder: "form.numberOfRoomsPlaceholder",
                            required: true,
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfRooms", write: "numberOfRooms"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfBathrooms",
                            widget: "#Input",
                            label: "form.numberOfBathroomsLabel",
                            placeholder: "form.numberOfBathroomsPlaceholder",
                            required: true,
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfBathrooms", write: "numberOfBathrooms"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "areaAndPricing" },
        permissions: {
            readAny: ["area", "sharedArea", "netArea", "verandaArea", "price", "priceCurrency"],
            writeAny: ["area", "sharedArea", "netArea", "verandaArea", "price", "priceCurrency"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "area",
                            widget: "#Input",
                            label: "form.areaLabel",
                            placeholder: "form.areaPlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "area", write: "area"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "sharedArea",
                            widget: "#Input",
                            label: "form.sharedAreaLabel",
                            placeholder: "form.sharedAreaPlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "sharedArea", write: "sharedArea"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "netArea",
                            widget: "#Input",
                            label: "form.netAreaLabel",
                            placeholder: "form.netAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "netArea", write: "netArea"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "verandaArea",
                            widget: "#Input",
                            label: "form.verandaAreaLabel",
                            placeholder: "form.verandaAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "verandaArea", write: "verandaArea"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "price",
                            widget: "#Input",
                            label: "form.priceLabel",
                            placeholder: "form.pricePlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "price", write: "price"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "priceCurrency",
                            widget: "#ApiSelect",
                            label: "form.priceCurrencyLabel",
                            placeholder: "form.priceCurrencyPlaceholder",
                            required: true,
                            widgetProps: { apiUrl: "/api/finance/currency/select" },
                        }, permissions: {read: "priceCurrency", write: "priceCurrency"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "layoutAndConstruction" },
        permissions: {
            readAny: ["orientation", "constructionStatus"],
            writeAny: ["orientation", "constructionStatus"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "orientation",
                            widget: "#SimpleSelect",
                            label: "form.orientationLabel",
                            placeholder: "form.orientationPlaceholder",
                            widgetProps: { options: orientationOptions, className: "grow w-full" },
                        }, permissions: {read: "orientation", write: "orientation"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "constructionStatus",
                            widget: "#SimpleSelect",
                            label: "form.constructionStatusLabel",
                            placeholder: "form.constructionStatusPlaceholder",
                            widgetProps: { options: constructionStatusOptions, className: "grow w-full" },
                        }, permissions: {read: "constructionStatus", write: "constructionStatus"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "features" },
        permissions: {
            readAny: ["hasBalcony", "hasTerrace", "hasSeaView", "hasCityView", "hasLakeView", "hasElevator"],
            writeAny: ["hasBalcony", "hasTerrace", "hasSeaView", "hasCityView", "hasLakeView", "hasElevator"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4 },
                children: [
                    // {
                    //     render: "#Field",
                    //     field: { name: "isAvailable", widget: "#Switch", label: "form.isAvailableLabel" },
                    // },
                    {
                        render: "#Field",
                        field: { name: "hasBalcony", widget: "#Switch", label: "form.hasBalconyLabel" },
                        permissions: {read: "hasBalcony", write: "hasBalcony"},
                    },
                    {
                        render: "#Field",
                        field: { name: "hasTerrace", widget: "#Switch", label: "form.hasTerraceLabel" },
                        permissions: {read: "hasTerrace", write: "hasTerrace"},
                    },
                    {
                        render: "#Field",
                        field: { name: "hasSeaView", widget: "#Switch", label: "form.hasSeaViewLabel" },
                        permissions: {read: "hasSeaView", write: "hasSeaView"},
                    },
                    {
                        render: "#Field",
                        field: { name: "hasCityView", widget: "#Switch", label: "form.hasCityViewLabel" },
                        permissions: {read: "hasCityView", write: "hasCityView"},
                    },
                    {
                        render: "#Field",
                        field: { name: "hasLakeView", widget: "#Switch", label: "form.hasLakeViewLabel" },
                        permissions: {read: "hasLakeView", write: "hasLakeView"},
                    },
                    {
                        render: "#Field",
                        field: { name: "hasElevator", widget: "#Switch", label: "form.hasElevatorLabel" },
                        permissions: {read: "hasElevator", write: "hasElevator"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "homepageFeatured" },
        permissions: {
            readAny: ["featuredOnHomepage", "featuredSortOrder"],
            writeAny: ["featuredOnHomepage", "featuredSortOrder"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "featuredOnHomepage",
                            widget: "#Switch",
                            label: "form.featuredOnHomepageLabel",
                        }, permissions: {read: "featuredOnHomepage", write: "featuredOnHomepage"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "featuredSortOrder",
                            widget: "#Input",
                            label: "form.featuredSortOrderLabel",
                            placeholder: "form.featuredSortOrderPlaceholder",
                            widgetProps: { type: "number", min: 0, step: 1 },
                        }, permissions: {read: "featuredSortOrder", write: "featuredSortOrder"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "commissions" },
        permissions: {
            readAny: ["saleCommissionRatePercent", "reservationCommissionRatePercent"],
            writeAny: ["saleCommissionRatePercent", "reservationCommissionRatePercent"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "saleCommissionRatePercent",
                            widget: "#Input",
                            label: "form.saleCommissionRateLabel",
                            placeholder: "form.saleCommissionRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: 0.1 },
                        }, permissions: {read: "saleCommissionRatePercent", write: "saleCommissionRatePercent"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reservationCommissionRatePercent",
                            widget: "#Input",
                            label: "form.reservationCommissionRateLabel",
                            placeholder: "form.reservationCommissionRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: 0.1 },
                        }, permissions: {read: "reservationCommissionRatePercent", write: "reservationCommissionRatePercent"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "connectedUnits" },
        permissions: { readAny: ["connectedUnits"], writeAny: ["connectedUnits"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "connectedUnits",
                    label: "form.connectedUnitsLabel",
                    placeholder: "form.addConnectedUnitPlaceholder",
                    widget: "#ApiSelect",
                    widgetProps: {
                        apiUrl: "/api/realEstate/unit/select",
                        multiple: true,
                        showSelectedChips: true,
                        postBodyFromFormFields: [
                            { field: "project", paramName: "project" },
                            { field: "edifice", paramName: "edifice" },
                        ],
                        enableWhenFormFieldsNonEmpty: ["project", "edifice"],
                        postBodyFormExtrasMerge: { notId: "unitId", notConnected: true },
                    },
                }, permissions: {read: "connectedUnits", write: "connectedUnits"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "unitLocation" },
        permissions: { readAny: ["polygonCoordinates"], writeAny: ["polygonCoordinates"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "__unitPolygon",
                    widget: "#FormUnitPolygon",
                    widgetProps: {
                        floorField: "floor",
                        polygonField: "polygonCoordinates",
                        closedField: "polygonClosed",
                        projectField: "project",
                        edificeField: "edifice",
                        hintKey: "selectUnitLocation",
                        errorLoadingKey: "errorLoadingFloor",
                        noImageKey: "floorNoMainImage",
                    },
                }, permissions: {read: "polygonCoordinates", write: "polygonCoordinates"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "form.mainImageLabel" },
        permissions: { readAny: ["mainImage"], writeAny: ["mainImage"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "mainImage",
                    widget: "#MediaField",
                    label: "form.mainImageLabel",
                    widgetProps: { mediaType: "image", mode: "single" },
                }, permissions: {read: "mainImage", write: "mainImage"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "form.imageGalleryLabel" },
        permissions: { readAny: ["imageGallery"], writeAny: ["imageGallery"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "imageGallery",
                    widget: "#MediaField",
                    label: "form.imageGalleryLabel",
                    widgetProps: { mediaType: "image", mode: "multiple", maxCount: 10 },
                }, permissions: {read: "imageGallery", write: "imageGallery"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "form.videoGalleryLabel" },
        permissions: { readAny: ["videoGallery"], writeAny: ["videoGallery"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "videoGallery",
                    widget: "#MediaField",
                    label: "form.videoGalleryLabel",
                    widgetProps: { mediaType: "video", mode: "multiple", maxCount: 3 },
                }, permissions: {read: "videoGallery", write: "videoGallery"},
            },
        ],
    },

    // ── Media files (generic file attachments) ──────────────────
    {
        render: "#TitleWithCollapse",
        props: { title: "form.mediaFilesLabel" },
        permissions: { readAny: ["mediaFiles"], writeAny: ["mediaFiles"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "mediaFiles",
                    widget: "#MediaField",
                    label: "form.mediaFilesLabel",
                    widgetProps: { mediaType: "file", mode: "multiple", maxCount: 20 },
                }, permissions: {read: "mediaFiles", write: "mediaFiles"},
            },
        ],
    },

    // ── Marketing Booklet (single PDF) ──────────────────────────
    {
        render: "#TitleWithCollapse",
        props: { title: "form.marketingBookletLabel" },
        permissions: { readAny: ["marketingBooklet"], writeAny: ["marketingBooklet"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "marketingBooklet",
                    widget: "#MediaField",
                    label: "form.marketingBookletLabel",
                    widgetProps: { mediaType: "file", mode: "single", maxCount: 1, accept: "application/pdf,.pdf" },
                }, permissions: {read: "marketingBooklet", write: "marketingBooklet"},
            },
        ],
    },
];

export const unitCreateFormView: ViewConfig = {
    model: "units",
    viewType: "form",
    viewMode: "create",
    accessModel: "units",
    apiUrl: "/api/realEstate/unit",
    method: "PUT",
    nodes: unitCreateFormNode,
};

export const unitEditFormView: ViewConfig = {
    model: "units",
    viewType: "form",
    viewMode: "edit",
    accessModel: "units",
    apiUrl: "/api/realEstate/unit",
    method: "PATCH",
    nodes: unitEditFormNode,
};

export const unitViews: ViewConfig[] = [unitSheetView, unitCreateFormView, unitEditFormView,];
