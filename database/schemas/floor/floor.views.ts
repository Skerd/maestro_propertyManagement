import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const floorSheetView: ViewConfig = {
    model: "floors",
    viewType: "sheet",
    accessModel: "floors",
    apiUrl: "/api/realEstate/floor",
    header: {
        titleField: "name",
        subtitleKey: "floor",
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
                            permissions: { read: "edifice" },
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
                            permissions: { read: "levelNumber" },
                            field: {
                                name: "levelNumber",
                                widget: "#SmallInfoCard",
                                label: "levelNumber",
                                widgetProps: { icon: "#Layers" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "totalUnits" },
                            field: {
                                name: "totalUnits",
                                widget: "#SmallInfoCard",
                                label: "totalUnits",
                                widgetProps: { icon: "#DoorOpen" },
                            },
                        },
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
                            permissions: { read: "isAccessible" },
                            field: {
                                name: "isAccessible",
                                widget: "#SmallInfoCard",
                                label: "isAccessible",
                                widgetProps: { icon: "#Accessibility", valueType: "boolean" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "hasEmergencyExit" },
                            field: {
                                name: "hasEmergencyExit",
                                widget: "#SmallInfoCard",
                                label: "hasEmergencyExit",
                                widgetProps: { icon: "#ShieldAlert", valueType: "boolean" },
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
                                name: "statistics.unitsByStatus.leased",
                                widget: "#SmallInfoCard",
                                label: "statistics.leasedUnits",
                                widgetProps: { icon: "#Key", tooltip: "statistics.leasedUnits" },
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
            props: { title: "sharedSpaces" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "sharedSpaces" },
                            field: {
                                name: "sharedSpaces",
                                widget: "#SmallInfoCard",
                                label: "sharedSpaces",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    valueType: "stringBadgeList",
                                    tooltip: "sharedSpaces",
                                },
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
            props: { title: "gallery" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: { read: "mainImage" },
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
                                    invertColorsOnDarkMode: true
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

const floorFormSharedContent: ViewConfig["nodes"] = [
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
                        props: { skipRenderWhenFormExtraTruthy: "hasRouteEdificeId" },
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
                        props: { skipRenderWhenFormExtraTruthy: "hasRouteEdificeId" },
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                pageSize: 50,
                                postBodyFromFormField: { field: "project", paramName: "project" },
                                remountKeyFormField: "project",
                            },
                        },
                    },
                ],
            },
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
                            name: "levelNumber",
                            widget: "#Input",
                            label: "form.levelNumberLabel",
                            placeholder: "form.levelNumberPlaceholder",
                            required: true,
                            widgetProps: { type: "number" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "totalUnits",
                            widget: "#Input",
                            label: "form.totalUnitsLabel",
                            placeholder: "form.totalUnitsPlaceholder",
                            required: true,
                            widgetProps: { type: "number", min: 0 },
                        },
                    },
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
        props: { title: "floorLocation" },
        permissions: { write: "polygonCoordinates" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "__floorPolygon",
                    widget: "#FormFloorPolygon",
                    widgetProps: {
                        polygonField: "polygonCoordinates",
                        closedField: "polygonClosed",
                        projectField: "project",
                        hintKey: "selectFloorLocation",
                        errorLoadingKey: "errorLoadingEdifice",
                        noImageKey: "edificeNoMainImage",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "sharedSpaces" },
        permissions: { write: "sharedSpaces" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "sharedSpaces",
                    widget: "#StringArrayField",
                    label: "form.sharedSpacesLabel",
                    placeholder: "form.sharedSpacesPlaceholder",
                    widgetProps: { removeTooltipKey: "removeSharedSpace" },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "features" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "isAccessible",
                            widget: "#Switch",
                            label: "form.isAccessibleLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "hasEmergencyExit",
                            widget: "#Switch",
                            label: "form.hasEmergencyExitLabel",
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

export const floorCreateFormView: ViewConfig = {
    model: "floors",
    viewType: "form",
    viewMode: "create",
    accessModel: "floors",
    apiUrl: "/api/realEstate/floor",
    method: "PUT",
    nodes: floorFormSharedContent,
};

export const floorEditFormView: ViewConfig = {
    model: "floors",
    viewType: "form",
    viewMode: "edit",
    accessModel: "floors",
    apiUrl: "/api/realEstate/floor",
    method: "PATCH",
    nodes: floorFormSharedContent,
};

export const floorViews: ViewConfig[] = [
    floorSheetView,
    floorCreateFormView,
    floorEditFormView,
];
