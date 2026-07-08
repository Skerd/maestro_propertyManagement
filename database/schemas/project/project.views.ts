import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const projectSheetView: ViewConfig = {
    model: "projects",
    viewType: "sheet",
    accessModel: "projects",
    apiUrl: "/api/realEstate/project",
    header: {
        titleField: "name",
        subtitleKey: "project",
        showCloseButton: true,
    },
    nodes: [
        // ── Overview ─────────────────────────────────────────────────
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
                            permissions: { read: "saleCommissionRatePercent" },
                            field: {
                                name: "saleCommissionRatePercent",
                                widget: "#SmallInfoCard",
                                label: "saleCommission",
                                widgetProps: {
                                    icon: "#Percent",
                                    suffix: "%",
                                    tooltip: "saleCommissionTooltip",

                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "reservationCommissionRatePercent" },
                            field: {
                                name: "reservationCommissionRatePercent",
                                widget: "#SmallInfoCard",
                                label: "reservationCommission",
                                widgetProps: {
                                    icon: "#Percent",
                                    suffix: "%",
                                    tooltip: "reservationCommissionTooltip"
                                },
                            },
                        },
                    ],
                },
            ],
        },

        // ── Statistics (conditional on statistics object existing) ───
        {
            render: "#SheetGroup",
            dependent: "statistics",
            dependentRuntimeOnly: true,
            props: { title: "statisticsTitle" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalEdifices",
                                widget: "#SmallInfoCard",
                                label: "statistics.edifices",
                                widgetProps: {
                                    icon: "#Building",
                                    tooltip: "statistics.edificesTooltip",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalFloors",
                                widget: "#SmallInfoCard",
                                label: "statistics.floors",
                                widgetProps: {
                                    icon: "#Layers",
                                    tooltip: "statistics.floorsTooltip",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalUnits",
                                widget: "#SmallInfoCard",
                                label: "statistics.units",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    tooltip: "statistics.unitsTooltip",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.totalArea",
                                widget: "#SmallInfoCard",
                                label: "statistics.area",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    tooltip: "statistics.areaTooltip",
                                    format: "locale",
                                    suffix: "m²",
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
                                        name: "statistics.totalInvestmentValue",
                                        widget: "#SmallInfoCard",
                                        label: "statistics.investment",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.investmentTooltip",
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
                                name: "statistics.unitsByStatus.available",
                                widget: "#SmallInfoCard",
                                label: "statistics.availableUnits",
                                widgetProps: {icon: "#CheckCircle", tooltip: "statistics.availableUnits"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.reserved",
                                widget: "#SmallInfoCard",
                                label: "statistics.reservedUnits",
                                widgetProps: {icon: "#BookMarked", tooltip: "statistics.reservedUnits"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.sold",
                                widget: "#SmallInfoCard",
                                label: "statistics.soldUnits",
                                widgetProps: {icon: "#DollarSign", tooltip: "statistics.soldUnits"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            field: {
                                name: "statistics.unitsByStatus.unavailable",
                                widget: "#SmallInfoCard",
                                label: "statistics.unavailableUnits",
                                widgetProps: {icon: "#XCircle", tooltip: "statistics.unavailableUnits"},
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

        // ── Description ──────────────────────────────────────────────
        {
            render: "#SheetGroup",
            props: { title: "description" },
            children: [
                {
                    render: "div",
                    props: { className: "p-2 rounded-lg bg-muted/30 border border-border/50" },
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

        // ── Gallery ──────────────────────────────────────────────────
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

const projectFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 1 },
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
                            name: "description",
                            widget: "#Textarea",
                            label: "form.descriptionLabel",
                            placeholder: "form.descriptionPlaceholder",
                            widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
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
                            widgetProps: { type: "decimal", min: 0, max: 100, step: "0.0001" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reservationCommissionRatePercent",
                            widget: "#Input",
                            label: "form.reservationCommissionRateLabel",
                            placeholder: "form.reservationCommissionRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: "0.0001" },
                        },
                    },
                ],
            },
        ],
    },

    // ── Main image (single image picker) ────────────────────────
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

    // ── Image gallery (multiple image picker) ───────────────────
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

    // ── Video gallery (multiple video picker) ───────────────────
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

export const projectCreateFormView: ViewConfig = {
    model: "projects",
    viewType: "form",
    viewMode: "create",
    accessModel: "projects",
    apiUrl: "/api/realEstate/project",
    method: "PUT",
    nodes: projectFormFields,
};

export const projectEditFormView: ViewConfig = {
    model: "projects",
    viewType: "form",
    viewMode: "edit",
    accessModel: "projects",
    apiUrl: "/api/realEstate/project",
    method: "PATCH",
    nodes: projectFormFields,
};

export const projectViews: ViewConfig[] = [projectSheetView, projectCreateFormView, projectEditFormView];
