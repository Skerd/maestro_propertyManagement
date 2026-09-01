import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {EDIFICE_ENERGY_CLASS_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.constants";
import {
    EDIFICE_FACILITY_ITEM_MAX,
    EDIFICE_FACILITY_MAX_ITEMS,
    EDIFICE_PERMIT_NUMBER_MAX,
    EDIFICE_POSTAL_CODE_MAX,
    EDIFICE_SHORT_TEXT_MAX,
    EDIFICE_STREET_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const energyClassOptions = EDIFICE_ENERGY_CLASS_VALUES.map((value) => ({value, label: value}));

export const edificeSheetView: ViewConfig = {
    model: "edifices",
    viewType: "sheet",
    accessModel: "edifices",
    apiUrl: "/api/realEstate/edifice",
    header: {
        titleField: "name",
        subtitleKey: "edifice",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            permissions: {
                readAny: [
                    "name",
                    "project",
                    "totalArea",
                    "greenArea",
                    "distanceFromCityCenter",
                    "investmentValue",
                    "pricePerMeterSquared",
                    "verandaPricePerMeterSquared",
                    "saleCurrency",
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
                            permissions: { read: "project" },
                            field: {
                                name: "project.name",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: { read: "totalArea" },
                            field: {
                                name: "totalArea",
                                widget: "#DisplayCard",
                                label: "totalArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" , type: "area"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "greenArea" },
                            field: {
                                name: "greenArea",
                                widget: "#DisplayCard",
                                label: "greenArea",
                                widgetProps: { icon: "#TreePine", format: "locale", suffix: "m²" , type: "area"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "distanceFromCityCenter" },
                            field: {
                                name: "distanceFromCityCenter",
                                widget: "#DisplayCard",
                                label: "distanceFromCityCenter",
                                widgetProps: { icon: "#MapPin", format: "locale", suffix: "m" , type: "locale"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "investmentValue" },
                            field: {
                                name: "investmentValue",
                                widget: "#DisplayCard",
                                label: "investmentValue",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["investmentCurrency.symbol", "investmentValue"],
                                    joinSeparator: " ",
                                    linkedRefPath: "investmentCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "pricePerMeterSquared" },
                            field: {
                                name: "pricePerMeterSquared",
                                widget: "#DisplayCard",
                                label: "pricePerMeterSquared",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "pricePerMeterSquared"],
                                    joinSeparator: " ",
                                    suffix: "/m²",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "verandaPricePerMeterSquared" },
                            field: {
                                name: "verandaPricePerMeterSquared",
                                widget: "#DisplayCard",
                                label: "verandaPricePerMeterSquared",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "verandaPricePerMeterSquared"],
                                    joinSeparator: " ",
                                    suffix: "/m²",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "saleCurrency" },
                            field: {
                                name: "saleCurrency.name",
                                widget: "#DisplayCard",
                                label: "saleCurrency",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
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
                    "numberOfFloors",
                    "numberOfFloorsAboveGround",
                    "numberOfFloorsUnderGround",
                    "numberOfParkingSpaces",
                    "numberOfGarages",
                ],
            },
            props: { title: "buildingDetails" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfFloors" },
                            field: {
                                name: "numberOfFloors",
                                widget: "#DisplayCard",
                                label: "numberOfFloors",
                                widgetProps: { icon: "#Layers" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfFloorsAboveGround" },
                            field: {
                                name: "numberOfFloorsAboveGround",
                                widget: "#DisplayCard",
                                label: "numberOfFloorsAboveGround",
                                widgetProps: { icon: "#ArrowUp" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfFloorsUnderGround" },
                            field: {
                                name: "numberOfFloorsUnderGround",
                                widget: "#DisplayCard",
                                label: "numberOfFloorsUnderGround",
                                widgetProps: { icon: "#ArrowDown" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfParkingSpaces" },
                            field: {
                                name: "numberOfParkingSpaces",
                                widget: "#DisplayCard",
                                label: "numberOfParkingSpaces",
                                widgetProps: { icon: "#Car" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "numberOfGarages" },
                            field: {
                                name: "numberOfGarages",
                                widget: "#DisplayCard",
                                label: "numberOfGarages",
                                widgetProps: { icon: "#IconCarGarage" , type: "number"},
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
                    "constructionStartDate",
                    "expectedCompletionDate",
                    "actualCompletionDate",
                    "buildingPermitNumber",
                    "energyClass",
                ],
            },
            props: { title: "constructionTimeline" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "constructionStartDate" },
                            field: {
                                name: "constructionStartDate",
                                widget: "#DisplayCard",
                                label: "constructionStartDate",
                                widgetProps: { icon: "#Calendar", format: "date" , type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "expectedCompletionDate" },
                            field: {
                                name: "expectedCompletionDate",
                                widget: "#DisplayCard",
                                label: "expectedCompletionDate",
                                widgetProps: { icon: "#CalendarClock", format: "date" , type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "actualCompletionDate" },
                            field: {
                                name: "actualCompletionDate",
                                widget: "#DisplayCard",
                                label: "actualCompletionDate",
                                widgetProps: { icon: "#CalendarCheck", format: "date" , type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "buildingPermitNumber" },
                            field: {
                                name: "buildingPermitNumber",
                                widget: "#DisplayCard",
                                label: "buildingPermitNumber",
                                widgetProps: { icon: "#FileText" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "energyClass" },
                            field: {
                                name: "energyClass",
                                widget: "#DisplayCard",
                                label: "energyClass",
                                widgetProps: { icon: "#Bolt" },
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
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.totalFloors",
                                widget: "#DisplayCard",
                                label: "statistics.floors",
                                widgetProps: { icon: "#Layers", tooltip: "statistics.floors" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.totalUnits",
                                widget: "#DisplayCard",
                                label: "statistics.units",
                                widgetProps: { icon: "#DoorOpen", tooltip: "statistics.units" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.unitsByStatus.available",
                                widget: "#DisplayCard",
                                label: "statistics.availableUnits",
                                widgetProps: { icon: "#CheckCircle", tooltip: "statistics.availableUnits" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.unitsByStatus.reserved",
                                widget: "#DisplayCard",
                                label: "statistics.reservedUnits",
                                widgetProps: { icon: "#BookMarked", tooltip: "statistics.reservedUnits" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.unitsByStatus.sold",
                                widget: "#DisplayCard",
                                label: "statistics.soldUnits",
                                widgetProps: { icon: "#DollarSign", tooltip: "statistics.soldUnits" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.unitsByStatus.leased",
                                widget: "#DisplayCard",
                                label: "statistics.leasedUnits",
                                widgetProps: { icon: "#Key", tooltip: "statistics.leasedUnits" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.unitsByStatus.unavailable",
                                widget: "#DisplayCard",
                                label: "statistics.unavailableUnits",
                                widgetProps: { icon: "#XCircle", tooltip: "statistics.unavailableUnits" , type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.totalUnitsArea",
                                widget: "#DisplayCard",
                                label: "statistics.totalArea",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    format: "locale",
                                    suffix: "m²",
                                    tooltip: "statistics.totalArea",
                                    type: "area",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.totalUnitsNetArea",
                                widget: "#DisplayCard",
                                label: "statistics.netArea",
                                widgetProps: {
                                    icon: "#IconRuler3",
                                    format: "locale",
                                    suffix: "m²",
                                    tooltip: "statistics.netArea",
                                    type: "area",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            field: {
                                name: "statistics.totalUnitsSharedArea",
                                widget: "#DisplayCard",
                                label: "statistics.sharedArea",
                                widgetProps: {
                                    icon: "#IconRuler3",
                                    format: "locale",
                                    suffix: "m²",
                                    tooltip: "statistics.sharedArea",
                                    type: "area",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.totalValue",
                                        widget: "#DisplayCard",
                                        label: "statistics.totalValue",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.totalValueTooltip",
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
                                name: "statistics.totalUnitCostDocuments",
                                widget: "#DisplayCard",
                                label: "statistics.totalUnitCostDocuments",
                                widgetProps: {
                                    icon: "#FileStack",
                                    tooltip: "statistics.totalUnitCostDocumentsTooltip",
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
            permissions: { readAny: ["propertyTypes"] },
            props: { title: "propertyTypes" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "propertyTypes" },
                            field: {
                                name: "propertyTypes",
                                widget: "#DisplayCard",
                                label: "propertyTypes",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    tooltip: "propertyTypes",
                                    valueType: "linkedObjectRefCardList",
                                    labelField: "name",
                                    linkedRefListLayout: "responsive4",
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
            permissions: { readAny: ["commercialFacilities", "neighborhoodFacilities"] },
            props: { title: "facilities" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "commercialFacilities" },
                            field: {
                                name: "commercialFacilities",
                                widget: "#DisplayCard",
                                label: "commercialFacilities",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    tooltip: "commercialFacilities",
                                    valueType: "stringBadgeList",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "neighborhoodFacilities" },
                            field: {
                                name: "neighborhoodFacilities",
                                widget: "#DisplayCard",
                                label: "neighborhoodFacilities",
                                widgetProps: {
                                    icon: "#IconTrees",
                                    tooltip: "neighborhoodFacilities",
                                    valueType: "stringBadgeList",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: { readAny: ["constructors"] },
            props: { title: "constructors" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "constructors" },
                            field: {
                                name: "constructors",
                                widget: "#DisplayCard",
                                label: "constructors",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    tooltip: "constructors",
                                    valueType: "linkedObjectRefCardList",
                                    labelField: "name",
                                    linkedRefListLayout: "responsive4",
                                    linkedSheetModel: "constructors",
                                    linkedSheetWidget: "#ConstructorSheetView",
                                    linkedSheetEntityProp: "constructor",
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
                storageKey: "edifice.sheet.address.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: { readAny: ["address"] },
                    props: {
                        title: "address",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#SheetAddressSection",
                                    permissions: { read: "address" },
                                    field: {
                                        name: "address",
                                        widget: "#SheetAddressSection",
                                        widgetProps: {
                                            badgeAccessModel: "edifices",
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

const edificeCreateFormNode: ViewConfig["nodes"] = [
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
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: { maxLength: EDIFICE_SHORT_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            required: true,
                            widgetProps: { apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "address" },
        children: [
            {
                render: "div",
                props: {className: "grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"},
                children: [
                    {
                        render: "div",
                        props: {className: "lg:col-span-2 space-y-6 min-w-0"},
                        children: [
                            {
                                render: "#FormGrid",
                                props: {columns: 3, className: "gap-6"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.country",
                                            widget: "#ApiSelect",
                                            label: "form.countryLabel",
                                            placeholder: "form.countryPlaceholder",
                                            widgetProps: {
                                                apiUrl: "/api/auxiliary/country/select",
                                                method: "POST",
                                                pageSize: 50,
                                                cascadeClearFormFields: ["address.state", "address.city"],
                                            },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.state",
                                            widget: "#ApiSelect",
                                            label: "form.stateLabel",
                                            placeholder: "form.statePlaceholder",
                                            widgetProps: {
                                                apiUrl: "/api/auxiliary/state/select",
                                                method: "POST",
                                                pageSize: 50,
                                                postBodyFromFormFields: [{field: "address.country", paramName: "country"}],
                                                enableWhenFormFieldsNonEmpty: ["address.country"],
                                                cascadeClearFormFields: ["address.city"],
                                            },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.city",
                                            widget: "#ApiSelect",
                                            label: "form.cityLabel",
                                            placeholder: "form.cityPlaceholder",
                                            widgetProps: {
                                                apiUrl: "/api/auxiliary/city/select",
                                                method: "POST",
                                                pageSize: 50,
                                                postBodyFromFormFields: [
                                                    {field: "address.country", paramName: "country"},
                                                    {field: "address.state", paramName: "state"},
                                                ],
                                                enableWhenFormFieldsNonEmpty: ["address.country"],
                                            },
                                        },
                                    },
                                ],
                            },
                            {
                                render: "#FormGrid",
                                props: {columns: 2, className: "gap-6"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.street",
                                            widget: "#Input",
                                            label: "form.streetLabel",
                                            placeholder: "form.streetPlaceholder",
                                            widgetProps: { maxLength: EDIFICE_STREET_MAX },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.postalCode",
                                            widget: "#Input",
                                            label: "form.postalCodeLabel",
                                            placeholder: "form.postalCodePlaceholder",
                                            widgetProps: { maxLength: EDIFICE_POSTAL_CODE_MAX },
                                        },
                                    },
                                ],
                            },
                            {
                                render: "#FormGrid",
                                props: {columns: 2, className: "gap-6"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {name: "address.latitude", widget: "#Input", label: "form.latitudeLabel", placeholder: "form.latitudePlaceholder", widgetProps: {type: "number", step: "0.000001"}},
                                    },
                                    {
                                        render: "#Field",
                                        field: {name: "address.longitude", widget: "#Input", label: "form.longitudeLabel", placeholder: "form.longitudePlaceholder", widgetProps: {type: "number", step: "0.000001"}},
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "flex flex-col lg:col-span-1 w-full min-h-[220px] h-[220px] lg:h-full lg:min-h-[220px]"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "_addressMap",
                                    widget: "#FormMapPinPicker",
                                    skipWriteAccessGate: true,
                                    widgetProps: {fieldPrefix: "address", latField: "latitude", lngField: "longitude", defaultLat: 41.3275, defaultLng: 19.8189},
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "investment" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "investmentValue",
                            widget: "#Input",
                            label: "form.investmentValueLabel",
                            placeholder: "form.investmentValuePlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "investmentCurrency",
                            widget: "#ApiSelect",
                            label: "form.investmentCurrencyLabel",
                            placeholder: "form.investmentCurrencyPlaceholder",
                            widgetProps: { apiUrl: "/api/finance/currency/select", method: "GET" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "pricePerMeterSquared",
                            widget: "#Input",
                            label: "form.pricePerMeterSquaredLabel",
                            placeholder: "form.pricePerMeterSquaredPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "verandaPricePerMeterSquared",
                            widget: "#Input",
                            label: "form.verandaPricePerMeterSquareLabel",
                            placeholder: "form.verandaPricePerMeterSquarePlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "saleCurrency",
                            widget: "#ApiSelect",
                            label: "form.saleCurrencyLabel",
                            placeholder: "form.saleCurrencyPlaceholder",
                            widgetProps: { apiUrl: "/api/finance/currency/select", method: "GET" },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "edificeLocationOnProject" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "__edificeProjectPolygon",
                    widget: "#FormEdificePolygon",
                    widgetProps: {
                        polygonField: "polygonCoordinates",
                        projectField: "project",
                        hintKey: "selectEdificeLocationOnProject",
                        errorTitleKey: "polygonSelectorErrorTitle",
                        errorLoadingKey: "errorLoadingProject",
                        noImageKey: "projectNoMainImage",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "constructors" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "constructors",
                    widget: "#FormObjectIdChips",
                    widgetProps: {
                        apiUrl: "/api/realEstate/constructor/select",
                        method: "POST",
                        placeholderKey: "form.selectConstructor",
                        removeTooltipKey: "removeConstructor",
                        selectPageSizeCreate: 50,
                        selectPageSizeEdit: 200,
                        labelRefFormExtraKey: "constructors",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "propertyTypes" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "propertyTypes",
                    widget: "#FormObjectIdChips",
                    widgetProps: {
                        apiUrl: "/api/realEstate/unitType/select",
                        method: "POST",
                        placeholderKey: "form.selectPropertyType",
                        removeTooltipKey: "removePropertyType",
                        selectPageSizeCreate: 50,
                        selectPageSizeEdit: 200,
                        labelRefFormExtraKey: "propertyTypes",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "areaAndDistance" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "totalArea",
                            widget: "#Input",
                            label: "form.totalAreaLabel",
                            placeholder: "form.totalAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "greenArea",
                            widget: "#Input",
                            label: "form.greenAreaLabel",
                            placeholder: "form.greenAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "distanceFromCityCenter",
                            widget: "#Input",
                            label: "form.distanceFromCityCenterLabel",
                            placeholder: "form.distanceFromCityCenterPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "buildingDetails" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfFloors",
                            widget: "#Input",
                            label: "form.numberOfFloorsLabel",
                            placeholder: "form.numberOfFloorsPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfFloorsAboveGround",
                            widget: "#Input",
                            label: "form.numberOfFloorsAboveGroundLabel",
                            placeholder: "form.numberOfFloorsAboveGroundPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfFloorsUnderGround",
                            widget: "#Input",
                            label: "form.numberOfFloorsUnderGroundLabel",
                            placeholder: "form.numberOfFloorsUnderGroundPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfParkingSpaces",
                            widget: "#Input",
                            label: "form.numberOfParkingSpacesLabel",
                            placeholder: "form.numberOfParkingSpacesPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfGarages",
                            widget: "#Input",
                            label: "form.numberOfGaragesLabel",
                            placeholder: "form.numberOfGaragesPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "constructionTimeline" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "constructionStartDate",
                            widget: "#DateInput",
                            label: "form.constructionStartDateLabel",
                            placeholder: "form.constructionStartDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expectedCompletionDate",
                            widget: "#DateInput",
                            label: "form.expectedCompletionDateLabel",
                            placeholder: "form.expectedCompletionDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "actualCompletionDate",
                            widget: "#DateInput",
                            label: "form.actualCompletionDateLabel",
                            placeholder: "form.actualCompletionDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "buildingPermitNumber",
                            widget: "#Input",
                            label: "form.buildingPermitNumberLabel",
                            placeholder: "form.buildingPermitNumberPlaceholder",
                            widgetProps: { maxLength: EDIFICE_PERMIT_NUMBER_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "energyClass",
                            widget: "#SimpleSelect",
                            label: "form.energyClassLabel",
                            placeholder: "form.energyClassPlaceholder",
                            widgetProps: { options: energyClassOptions, className: "grow w-full" },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "facilities" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "commercialFacilities",
                            widget: "#StringArrayField",
                            label: "form.commercialFacilitiesLabel",
                            placeholder: "form.commercialFacilitiesPlaceholder",
                            widgetProps: {
                                removeTooltipKey: "removeCommercialFacility",
                                maxItems: EDIFICE_FACILITY_MAX_ITEMS,
                                maxLength: EDIFICE_FACILITY_ITEM_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "neighborhoodFacilities",
                            widget: "#StringArrayField",
                            label: "form.neighborhoodFacilitiesLabel",
                            placeholder: "form.neighborhoodFacilitiesPlaceholder",
                            widgetProps: {
                                removeTooltipKey: "removeNeighborhoodFacility",
                                maxItems: EDIFICE_FACILITY_MAX_ITEMS,
                                maxLength: EDIFICE_FACILITY_ITEM_MAX,
                            },
                        },
                    },
                ],
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

export const edificeCreateFormView: ViewConfig = {
    model: "edifices",
    viewType: "form",
    viewMode: "create",
    accessModel: "edifices",
    apiUrl: "/api/realEstate/edifice",
    method: "PUT",
    nodes: edificeCreateFormNode,
};

const edificeEditFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        permissions: {
            readAny: ["name", "project"],
            writeAny: ["name", "project"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: { maxLength: EDIFICE_SHORT_TEXT_MAX },
                        }, permissions: {read: "name", write: "name"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            widgetProps: { apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50 },
                        }, permissions: {read: "project", write: "project"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "address" },
        permissions: {
            readAny: ["address"],
            writeAny: ["address"],
        },
        children: [
            {
                render: "div",
                props: {className: "grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"},
                children: [
                    {
                        render: "div",
                        props: {className: "lg:col-span-2 space-y-6 min-w-0"},
                        children: [
                            {
                                render: "#FormGrid",
                                props: {columns: 3, className: "gap-6"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.country",
                                            widget: "#ApiSelect",
                                            label: "form.countryLabel",
                                            placeholder: "form.countryPlaceholder",
                                            widgetProps: {
                                                apiUrl: "/api/auxiliary/country/select",
                                                method: "POST",
                                                pageSize: 50,
                                                cascadeClearFormFields: ["address.state", "address.city"],
                                            },
                                        }, permissions: {read: "address", write: "address"},
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.state",
                                            widget: "#ApiSelect",
                                            label: "form.stateLabel",
                                            placeholder: "form.statePlaceholder",
                                            widgetProps: {
                                                apiUrl: "/api/auxiliary/state/select",
                                                method: "POST",
                                                pageSize: 50,
                                                postBodyFromFormFields: [{field: "address.country", paramName: "country"}],
                                                enableWhenFormFieldsNonEmpty: ["address.country"],
                                                cascadeClearFormFields: ["address.city"],
                                            },
                                        }, permissions: {read: "address", write: "address"},
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.city",
                                            widget: "#ApiSelect",
                                            label: "form.cityLabel",
                                            placeholder: "form.cityPlaceholder",
                                            widgetProps: {
                                                apiUrl: "/api/auxiliary/city/select",
                                                method: "POST",
                                                pageSize: 50,
                                                postBodyFromFormFields: [
                                                    {field: "address.country", paramName: "country"},
                                                    {field: "address.state", paramName: "state"},
                                                ],
                                                enableWhenFormFieldsNonEmpty: ["address.country"],
                                            },
                                        }, permissions: {read: "address", write: "address"},
                                    },
                                ],
                            },
                            {
                                render: "#FormGrid",
                                props: {columns: 2, className: "gap-6"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.street",
                                            widget: "#Input",
                                            label: "form.streetLabel",
                                            placeholder: "form.streetPlaceholder",
                                            widgetProps: { maxLength: EDIFICE_STREET_MAX },
                                        }, permissions: {read: "address", write: "address"},
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "address.postalCode",
                                            widget: "#Input",
                                            label: "form.postalCodeLabel",
                                            placeholder: "form.postalCodePlaceholder",
                                            widgetProps: { maxLength: EDIFICE_POSTAL_CODE_MAX },
                                        }, permissions: {read: "address", write: "address"},
                                    },
                                ],
                            },
                            {
                                render: "#FormGrid",
                                props: {columns: 2, className: "gap-6"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {name: "address.latitude", widget: "#Input", label: "form.latitudeLabel", placeholder: "form.latitudePlaceholder", widgetProps: {type: "number", step: "0.000001"}},
                                        permissions: {read: "address", write: "address"},
                                    },
                                    {
                                        render: "#Field",
                                        field: {name: "address.longitude", widget: "#Input", label: "form.longitudeLabel", placeholder: "form.longitudePlaceholder", widgetProps: {type: "number", step: "0.000001"}},
                                        permissions: {read: "address", write: "address"},
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "flex flex-col lg:col-span-1 w-full min-h-[220px] h-[220px] lg:h-full lg:min-h-[220px]"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "_addressMap",
                                    widget: "#FormMapPinPicker",
                                    skipWriteAccessGate: true,
                                    widgetProps: {fieldPrefix: "address", latField: "latitude", lngField: "longitude", defaultLat: 41.3275, defaultLng: 19.8189},
                                }, permissions: {read: "address", write: "address"},
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "investment" },
        permissions: {
            readAny: [
                "investmentValue",
                "investmentCurrency",
                "pricePerMeterSquared",
                "verandaPricePerMeterSquared",
                "saleCurrency",
            ],
            writeAny: [
                "investmentValue",
                "investmentCurrency",
                "pricePerMeterSquared",
                "verandaPricePerMeterSquared",
                "saleCurrency",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "investmentValue",
                            widget: "#Input",
                            label: "form.investmentValueLabel",
                            placeholder: "form.investmentValuePlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "investmentValue", write: "investmentValue"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "investmentCurrency",
                            widget: "#ApiSelect",
                            label: "form.investmentCurrencyLabel",
                            placeholder: "form.investmentCurrencyPlaceholder",
                            widgetProps: { apiUrl: "/api/finance/currency/select", method: "GET" },
                        }, permissions: {read: "investmentCurrency", write: "investmentCurrency"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "pricePerMeterSquared",
                            widget: "#Input",
                            label: "form.pricePerMeterSquaredLabel",
                            placeholder: "form.pricePerMeterSquaredPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "pricePerMeterSquared", write: "pricePerMeterSquared"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "verandaPricePerMeterSquared",
                            widget: "#Input",
                            label: "form.verandaPricePerMeterSquareLabel",
                            placeholder: "form.verandaPricePerMeterSquarePlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "verandaPricePerMeterSquared", write: "verandaPricePerMeterSquared"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "saleCurrency",
                            widget: "#ApiSelect",
                            label: "form.saleCurrencyLabel",
                            placeholder: "form.saleCurrencyPlaceholder",
                            widgetProps: { apiUrl: "/api/finance/currency/select", method: "GET" },
                        }, permissions: {read: "saleCurrency", write: "saleCurrency"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "edificeLocationOnProject" },
        permissions: {
            readAny: ["polygonCoordinates"],
            writeAny: ["polygonCoordinates"],
        },
        children: [
            {
                render: "#Field",
                field: {
                    name: "__edificeProjectPolygon",
                    widget: "#FormEdificePolygon",
                    widgetProps: {
                        polygonField: "polygonCoordinates",
                        projectField: "project",
                        hintKey: "selectEdificeLocationOnProject",
                        errorTitleKey: "polygonSelectorErrorTitle",
                        errorLoadingKey: "errorLoadingProject",
                        noImageKey: "projectNoMainImage",
                    },
                }, permissions: {read: "polygonCoordinates", write: "polygonCoordinates"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "constructors" },
        permissions: { readAny: ["constructors"], writeAny: ["constructors"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "constructors",
                    widget: "#FormObjectIdChips",
                    widgetProps: {
                        apiUrl: "/api/realEstate/constructor/select",
                        method: "POST",
                        placeholderKey: "form.selectConstructor",
                        removeTooltipKey: "removeConstructor",
                        selectPageSizeCreate: 50,
                        selectPageSizeEdit: 200,
                        labelRefFormExtraKey: "constructors",
                    },
                }, permissions: {read: "constructors", write: "constructors"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "propertyTypes" },
        permissions: { readAny: ["propertyTypes"], writeAny: ["propertyTypes"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "propertyTypes",
                    widget: "#FormObjectIdChips",
                    widgetProps: {
                        apiUrl: "/api/realEstate/unitType/select",
                        method: "POST",
                        placeholderKey: "form.selectPropertyType",
                        removeTooltipKey: "removePropertyType",
                        selectPageSizeCreate: 50,
                        selectPageSizeEdit: 200,
                        labelRefFormExtraKey: "propertyTypes",
                    },
                }, permissions: {read: "propertyTypes", write: "propertyTypes"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "areaAndDistance" },
        permissions: {
            readAny: ["totalArea", "greenArea", "distanceFromCityCenter"],
            writeAny: ["totalArea", "greenArea", "distanceFromCityCenter"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "totalArea",
                            widget: "#Input",
                            label: "form.totalAreaLabel",
                            placeholder: "form.totalAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "totalArea", write: "totalArea"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "greenArea",
                            widget: "#Input",
                            label: "form.greenAreaLabel",
                            placeholder: "form.greenAreaPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "greenArea", write: "greenArea"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "distanceFromCityCenter",
                            widget: "#Input",
                            label: "form.distanceFromCityCenterLabel",
                            placeholder: "form.distanceFromCityCenterPlaceholder",
                            widgetProps: { type: "decimal", min: 0 },
                        }, permissions: {read: "distanceFromCityCenter", write: "distanceFromCityCenter"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "buildingDetails" },
        permissions: {
            readAny: [
                "numberOfFloors",
                "numberOfFloorsAboveGround",
                "numberOfFloorsUnderGround",
                "numberOfParkingSpaces",
                "numberOfGarages",
            ],
            writeAny: [
                "numberOfFloors",
                "numberOfFloorsAboveGround",
                "numberOfFloorsUnderGround",
                "numberOfParkingSpaces",
                "numberOfGarages",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfFloors",
                            widget: "#Input",
                            label: "form.numberOfFloorsLabel",
                            placeholder: "form.numberOfFloorsPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfFloors", write: "numberOfFloors"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfFloorsAboveGround",
                            widget: "#Input",
                            label: "form.numberOfFloorsAboveGroundLabel",
                            placeholder: "form.numberOfFloorsAboveGroundPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfFloorsAboveGround", write: "numberOfFloorsAboveGround"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfFloorsUnderGround",
                            widget: "#Input",
                            label: "form.numberOfFloorsUnderGroundLabel",
                            placeholder: "form.numberOfFloorsUnderGroundPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfFloorsUnderGround", write: "numberOfFloorsUnderGround"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfParkingSpaces",
                            widget: "#Input",
                            label: "form.numberOfParkingSpacesLabel",
                            placeholder: "form.numberOfParkingSpacesPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfParkingSpaces", write: "numberOfParkingSpaces"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfGarages",
                            widget: "#Input",
                            label: "form.numberOfGaragesLabel",
                            placeholder: "form.numberOfGaragesPlaceholder",
                            widgetProps: { type: "number", min: 0 },
                        }, permissions: {read: "numberOfGarages", write: "numberOfGarages"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "constructionTimeline" },
        permissions: {
            readAny: [
                "constructionStartDate",
                "expectedCompletionDate",
                "actualCompletionDate",
                "buildingPermitNumber",
                "energyClass",
            ],
            writeAny: [
                "constructionStartDate",
                "expectedCompletionDate",
                "actualCompletionDate",
                "buildingPermitNumber",
                "energyClass",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "constructionStartDate",
                            widget: "#DateInput",
                            label: "form.constructionStartDateLabel",
                            placeholder: "form.constructionStartDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        }, permissions: {read: "constructionStartDate", write: "constructionStartDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expectedCompletionDate",
                            widget: "#DateInput",
                            label: "form.expectedCompletionDateLabel",
                            placeholder: "form.expectedCompletionDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        }, permissions: {read: "expectedCompletionDate", write: "expectedCompletionDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "actualCompletionDate",
                            widget: "#DateInput",
                            label: "form.actualCompletionDateLabel",
                            placeholder: "form.actualCompletionDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        }, permissions: {read: "actualCompletionDate", write: "actualCompletionDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "buildingPermitNumber",
                            widget: "#Input",
                            label: "form.buildingPermitNumberLabel",
                            placeholder: "form.buildingPermitNumberPlaceholder",
                            widgetProps: { maxLength: EDIFICE_PERMIT_NUMBER_MAX },
                        }, permissions: {read: "buildingPermitNumber", write: "buildingPermitNumber"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "energyClass",
                            widget: "#SimpleSelect",
                            label: "form.energyClassLabel",
                            placeholder: "form.energyClassPlaceholder",
                            widgetProps: { options: energyClassOptions, className: "grow w-full" },
                        }, permissions: {read: "energyClass", write: "energyClass"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "facilities" },
        permissions: {
            readAny: ["commercialFacilities", "neighborhoodFacilities"],
            writeAny: ["commercialFacilities", "neighborhoodFacilities"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "commercialFacilities",
                            widget: "#StringArrayField",
                            label: "form.commercialFacilitiesLabel",
                            placeholder: "form.commercialFacilitiesPlaceholder",
                            widgetProps: {
                                removeTooltipKey: "removeCommercialFacility",
                                maxItems: EDIFICE_FACILITY_MAX_ITEMS,
                                maxLength: EDIFICE_FACILITY_ITEM_MAX,
                            },
                        }, permissions: {read: "commercialFacilities", write: "commercialFacilities"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "neighborhoodFacilities",
                            widget: "#StringArrayField",
                            label: "form.neighborhoodFacilitiesLabel",
                            placeholder: "form.neighborhoodFacilitiesPlaceholder",
                            widgetProps: {
                                removeTooltipKey: "removeNeighborhoodFacility",
                                maxItems: EDIFICE_FACILITY_MAX_ITEMS,
                                maxLength: EDIFICE_FACILITY_ITEM_MAX,
                            },
                        }, permissions: {read: "neighborhoodFacilities", write: "neighborhoodFacilities"},
                    },
                ],
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

export const edificeEditFormView: ViewConfig = {
    model: "edifices",
    viewType: "form",
    viewMode: "edit",
    accessModel: "edifices",
    apiUrl: "/api/realEstate/edifice",
    method: "PATCH",
    nodes: edificeEditFormNode,
};

export const edificeViews: ViewConfig[] = [edificeSheetView, edificeCreateFormView, edificeEditFormView];
