import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {UNIT_ORIENTATION_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants";

const orientationOptions = UNIT_ORIENTATION_VALUES.map((value) => ({value, label: value}));

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
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#SmallInfoCard",
                                label: "name",
                                widgetProps: { icon: "#IconLabel" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "unitNumber" },
                            field: {
                                name: "unitNumber",
                                widget: "#SmallInfoCard",
                                label: "unitNumber",
                                widgetProps: { icon: "#Hash" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "status" },
                            field: {
                                name: "status",
                                widget: "#SmallInfoCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "unitStatusEnum",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "project.name",
                                widget: "#SmallInfoCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "edifice.name",
                                widget: "#SmallInfoCard",
                                label: "edifice",
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
                            render: "#SmallInfoCard",
                            permissions: { read: "floor" },
                            field: {
                                name: "floor.name",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            field: {
                                name: "unitType.name",
                                widget: "#SmallInfoCard",
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
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "areaAndPricing" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "area" },
                            field: {
                                name: "area",
                                widget: "#SmallInfoCard",
                                label: "area",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "sharedArea" },
                            field: {
                                name: "sharedArea",
                                widget: "#SmallInfoCard",
                                label: "sharedArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "netArea" },
                            field: {
                                name: "netArea",
                                widget: "#SmallInfoCard",
                                label: "netArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "verandaArea" },
                            field: {
                                name: "verandaArea",
                                widget: "#SmallInfoCard",
                                label: "verandaArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "price" },
                            field: {
                                name: "price",
                                widget: "#SmallInfoCard",
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
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfRooms" },
                            field: {
                                name: "numberOfRooms",
                                widget: "#SmallInfoCard",
                                label: "numberOfRooms",
                                widgetProps: { icon: "#BedDouble" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfBathrooms" },
                            field: {
                                name: "numberOfBathrooms",
                                widget: "#SmallInfoCard",
                                label: "numberOfBathrooms",
                                widgetProps: { icon: "#Bath" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "layoutAndConstruction" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "orientation" },
                            field: {
                                name: "orientation",
                                widget: "#SmallInfoCard",
                                label: "orientation",
                                widgetProps: {
                                    icon: "#Compass",
                                    languageKeyCategory: "unitOrientationEnum",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "constructionStatus" },
                            field: {
                                name: "constructionStatus",
                                widget: "#SmallInfoCard",
                                label: "constructionStatus",
                                widgetProps: {
                                    icon: "#Hammer",
                                    languageKeyCategory: "unitConstructionStatusEnum",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "statisticsTitle" },
            dependent: "statistics",
            dependentRuntimeOnly: true,
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
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.collectedAmount",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.collectedAmount",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.collectedAmountTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
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
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.notCollectedAmount",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.notCollectedAmount",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.notCollectedAmountTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
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
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.averagePricePerSquareMeter",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.averagePricePerSquareMeter",
                                        widgetProps: {
                                            icon: "#IconGrid4x4",
                                            tooltip: "statistics.averagePricePerSquareMeterTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                            suffix: "/m²",
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
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.verifiedPaidUnitCosts",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.verifiedPaidUnitCosts",
                                        widgetProps: {
                                            icon: "#Receipt",
                                            tooltip: "statistics.verifiedPaidUnitCostsTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
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
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.verifiedOutstandingUnitCosts",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.verifiedOutstandingUnitCosts",
                                        widgetProps: {
                                            icon: "#Receipt",
                                            tooltip: "statistics.verifiedOutstandingUnitCostsTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
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
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.pendingVerificationUnitCosts",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.pendingVerificationUnitCosts",
                                        widgetProps: {
                                            icon: "#Receipt",
                                            tooltip: "statistics.pendingVerificationUnitCostsTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitCostDocumentCount",
                                widget: "#SmallInfoCard",
                                label: "statistics.unitCostDocumentCount",
                                widgetProps: {
                                    icon: "#FileStack",
                                    tooltip: "statistics.unitCostDocumentCountTooltip",
                                    format: "locale",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "features" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasBalcony" },
                            field: {
                                name: "hasBalcony",
                                widget: "#SmallInfoCard",
                                label: "hasBalcony",
                                widgetProps: { icon: "#Fence", valueType: "boolean" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasTerrace" },
                            field: {
                                name: "hasTerrace",
                                widget: "#SmallInfoCard",
                                label: "hasTerrace",
                                widgetProps: { icon: "#TreePine", valueType: "boolean" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasSeaView" },
                            field: {
                                name: "hasSeaView",
                                widget: "#SmallInfoCard",
                                label: "hasSeaView",
                                widgetProps: { icon: "#Waves", valueType: "boolean" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasCityView" },
                            field: {
                                name: "hasCityView",
                                widget: "#SmallInfoCard",
                                label: "hasCityView",
                                widgetProps: { icon: "#Building", valueType: "boolean" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasLakeView" },
                            field: {
                                name: "hasLakeView",
                                widget: "#SmallInfoCard",
                                label: "hasLakeView",
                                widgetProps: { icon: "#Droplets", valueType: "boolean" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasElevator" },
                            field: {
                                name: "hasElevator",
                                widget: "#SmallInfoCard",
                                label: "hasElevator",
                                widgetProps: { icon: "#ArrowUpDown", valueType: "boolean" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "commissions" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "saleCommissionRatePercent" },
                            field: {
                                name: "saleCommissionRatePercent",
                                widget: "#SmallInfoCard",
                                label: "saleCommission",
                                widgetProps: { icon: "#Percent", suffix: "%" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "reservationCommissionRatePercent" },
                            field: {
                                name: "reservationCommissionRatePercent",
                                widget: "#SmallInfoCard",
                                label: "reservationCommission",
                                widgetProps: { icon: "#Percent", suffix: "%" },
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "unit.sheet.inspections.listDisplay",
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
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
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
                    props: {
                        title: "unitCosts",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
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
                    props: {
                        title: "modificationRequests",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
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
                    props: {
                        title: "connectedUnits",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
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
                    props: {
                        title: "sale",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
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
                    props: {
                        title: "reservation",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
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
            props: { title: "gallery" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
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
            dependent: "mediaFiles",
            dependentRuntimeOnly: true,
            permissions: { read: "mediaFiles" },
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
            dependent: "marketingBooklet",
            dependentRuntimeOnly: true,
            permissions: { read: "marketingBooklet" },
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
    ],
};

const unitFormFields: ViewConfig["nodes"] = [
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
                    widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
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
        props: { title: "commissions" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        permissions: { write: "saleCommissionRatePercent" },
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
                        permissions: { write: "reservationCommissionRatePercent" },
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
        permissions: { write: "connectedUnits" },
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
        permissions: { write: "polygonCoordinates" },
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
        permissions: { write: "mainImage" },
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
        permissions: { write: "imageGallery" },
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
        permissions: { write: "videoGallery" },
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
        permissions: { write: "mediaFiles" },
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
        permissions: { write: "marketingBooklet" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "marketingBooklet",
                    widget: "#MediaField",
                    label: "form.marketingBookletLabel",
                    widgetProps: { mediaType: "file", mode: "single", maxCount: 1 },
                },
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
    nodes: unitFormFields,
};

export const unitEditFormView: ViewConfig = {
    model: "units",
    viewType: "form",
    viewMode: "edit",
    accessModel: "units",
    apiUrl: "/api/realEstate/unit",
    method: "PATCH",
    nodes: unitFormFields,
};

export const unitViews: ViewConfig[] = [unitSheetView, unitCreateFormView, unitEditFormView,];
