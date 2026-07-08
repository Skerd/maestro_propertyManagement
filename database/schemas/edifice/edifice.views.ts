import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {EDIFICE_ENERGY_CLASS_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/edifice/edifice.constants";

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
                            permissions: { read: "project" },
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
                            permissions: { read: "totalArea" },
                            field: {
                                name: "totalArea",
                                widget: "#SmallInfoCard",
                                label: "totalArea",
                                widgetProps: { icon: "#IconGrid4x4", format: "locale", suffix: "m²" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "greenArea" },
                            field: {
                                name: "greenArea",
                                widget: "#SmallInfoCard",
                                label: "greenArea",
                                widgetProps: { icon: "#TreePine", format: "locale", suffix: "m²" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "distanceFromCityCenter" },
                            field: {
                                name: "distanceFromCityCenter",
                                widget: "#SmallInfoCard",
                                label: "distanceFromCityCenter",
                                widgetProps: { icon: "#MapPin", format: "locale", suffix: "m" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "investmentValue" },
                            field: {
                                name: "investmentValue",
                                widget: "#SmallInfoCard",
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
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "pricePerMeterSquared" },
                            field: {
                                name: "pricePerMeterSquared",
                                widget: "#SmallInfoCard",
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
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "verandaPricePerMeterSquared" },
                            field: {
                                name: "verandaPricePerMeterSquared",
                                widget: "#SmallInfoCard",
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
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "saleCurrency" },
                            field: {
                                name: "saleCurrency.name",
                                widget: "#SmallInfoCard",
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
            props: { title: "buildingDetails" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfFloors" },
                            field: {
                                name: "numberOfFloors",
                                widget: "#SmallInfoCard",
                                label: "numberOfFloors",
                                widgetProps: { icon: "#Layers" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfFloorsAboveGround" },
                            field: {
                                name: "numberOfFloorsAboveGround",
                                widget: "#SmallInfoCard",
                                label: "numberOfFloorsAboveGround",
                                widgetProps: { icon: "#ArrowUp" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfFloorsUnderGround" },
                            field: {
                                name: "numberOfFloorsUnderGround",
                                widget: "#SmallInfoCard",
                                label: "numberOfFloorsUnderGround",
                                widgetProps: { icon: "#ArrowDown" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfParkingSpaces" },
                            field: {
                                name: "numberOfParkingSpaces",
                                widget: "#SmallInfoCard",
                                label: "numberOfParkingSpaces",
                                widgetProps: { icon: "#Car" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfGarages" },
                            field: {
                                name: "numberOfGarages",
                                widget: "#SmallInfoCard",
                                label: "numberOfGarages",
                                widgetProps: { icon: "#IconCarGarage" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "constructionTimeline" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "constructionStartDate" },
                            field: {
                                name: "constructionStartDate",
                                widget: "#SmallInfoCard",
                                label: "constructionStartDate",
                                widgetProps: { icon: "#Calendar", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "expectedCompletionDate" },
                            field: {
                                name: "expectedCompletionDate",
                                widget: "#SmallInfoCard",
                                label: "expectedCompletionDate",
                                widgetProps: { icon: "#CalendarClock", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "actualCompletionDate" },
                            field: {
                                name: "actualCompletionDate",
                                widget: "#SmallInfoCard",
                                label: "actualCompletionDate",
                                widgetProps: { icon: "#CalendarCheck", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "buildingPermitNumber" },
                            field: {
                                name: "buildingPermitNumber",
                                widget: "#SmallInfoCard",
                                label: "buildingPermitNumber",
                                widgetProps: { icon: "#FileText" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "energyClass" },
                            field: {
                                name: "energyClass",
                                widget: "#SmallInfoCard",
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
            props: { title: "statisticsTitle" },
            dependent: "statistics",
            dependentRuntimeOnly: true,
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalFloors",
                                widget: "#SmallInfoCard",
                                label: "statistics.floors",
                                widgetProps: { icon: "#Layers", tooltip: "statistics.floors" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalUnits",
                                widget: "#SmallInfoCard",
                                label: "statistics.units",
                                widgetProps: { icon: "#DoorOpen", tooltip: "statistics.units" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.available",
                                widget: "#SmallInfoCard",
                                label: "statistics.availableUnits",
                                widgetProps: { icon: "#CheckCircle", tooltip: "statistics.availableUnits" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.reserved",
                                widget: "#SmallInfoCard",
                                label: "statistics.reservedUnits",
                                widgetProps: { icon: "#BookMarked", tooltip: "statistics.reservedUnits" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.sold",
                                widget: "#SmallInfoCard",
                                label: "statistics.soldUnits",
                                widgetProps: { icon: "#DollarSign", tooltip: "statistics.soldUnits" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.unavailable",
                                widget: "#SmallInfoCard",
                                label: "statistics.unavailableUnits",
                                widgetProps: { icon: "#XCircle", tooltip: "statistics.unavailableUnits" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalUnitsArea",
                                widget: "#SmallInfoCard",
                                label: "statistics.totalArea",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    format: "locale",
                                    suffix: "m²",
                                    tooltip: "statistics.totalArea",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalUnitsNetArea",
                                widget: "#SmallInfoCard",
                                label: "statistics.netArea",
                                widgetProps: {
                                    icon: "#IconRuler3",
                                    format: "locale",
                                    suffix: "m²",
                                    tooltip: "statistics.netArea",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalUnitsSharedArea",
                                widget: "#SmallInfoCard",
                                label: "statistics.sharedArea",
                                widgetProps: {
                                    icon: "#IconRuler3",
                                    format: "locale",
                                    suffix: "m²",
                                    tooltip: "statistics.sharedArea",
                                },
                            },
                        },
                        {
                            render: "div",
                            props: { className: "md:col-span-2" },
                            children: [
                                {
                                    render: "#SmallInfoCard",
                                    field: {
                                        name: "statistics.totalValue",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.totalValue",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.totalValueTooltip",
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
                                name: "statistics.totalUnitCostDocuments",
                                widget: "#SmallInfoCard",
                                label: "statistics.totalUnitCostDocuments",
                                widgetProps: {
                                    icon: "#FileStack",
                                    tooltip: "statistics.totalUnitCostDocumentsTooltip",
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
            props: { title: "propertyTypes" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "propertyTypes" },
                            field: {
                                name: "propertyTypes",
                                widget: "#SmallInfoCard",
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
            props: { title: "facilities" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "commercialFacilities" },
                            field: {
                                name: "commercialFacilities",
                                widget: "#SmallInfoCard",
                                label: "commercialFacilities",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    tooltip: "commercialFacilities",
                                    valueType: "stringBadgeList",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "neighborhoodFacilities" },
                            field: {
                                name: "neighborhoodFacilities",
                                widget: "#SmallInfoCard",
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
            props: { title: "constructors" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "constructors" },
                            field: {
                                name: "constructors",
                                widget: "#SmallInfoCard",
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

const edificeFormFields: ViewConfig["nodes"] = [
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
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
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
                props: {className: "grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch"},
                children: [
                    {
                        render: "div",
                        props: {className: "lg:col-span-2 space-y-4 min-w-0"},
                        children: [
                            {
                                render: "#FormGrid",
                                props: {columns: 3},
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
                                props: {columns: 2},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {name: "address.street", widget: "#Input", label: "form.streetLabel", placeholder: "form.streetPlaceholder"},
                                    },
                                    {
                                        render: "#Field",
                                        field: {name: "address.postalCode", widget: "#Input", label: "form.postalCodeLabel", placeholder: "form.postalCodePlaceholder"},
                                    },
                                ],
                            },
                            {
                                render: "#FormGrid",
                                props: {columns: 2},
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
        permissions: { write: "polygonCoordinates" },
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
                            widgetProps: { removeTooltipKey: "removeCommercialFacility" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "neighborhoodFacilities",
                            widget: "#StringArrayField",
                            label: "form.neighborhoodFacilitiesLabel",
                            placeholder: "form.neighborhoodFacilitiesPlaceholder",
                            widgetProps: { removeTooltipKey: "removeNeighborhoodFacility" },
                        },
                    },
                ],
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

export const edificeCreateFormView: ViewConfig = {
    model: "edifices",
    viewType: "form",
    viewMode: "create",
    accessModel: "edifices",
    apiUrl: "/api/realEstate/edifice",
    method: "PUT",
    nodes: edificeFormFields,
};

export const edificeEditFormView: ViewConfig = {
    model: "edifices",
    viewType: "form",
    viewMode: "edit",
    accessModel: "edifices",
    apiUrl: "/api/realEstate/edifice",
    method: "PATCH",
    nodes: edificeFormFields,
};

export const edificeViews: ViewConfig[] = [edificeSheetView, edificeCreateFormView, edificeEditFormView];
