import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    PROJECT_LONG_TEXT_MAX,
    PROJECT_SHORT_TEXT_MAX,
    PROJECT_URL_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/project/project.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {PRICE_VISIBILITY_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/priceVisibility.constants";

/** Public price visibility select: inherit from parent, hide (price on request) or show. */
const priceVisibilityOptions = PRICE_VISIBILITY_VALUES.map((value) => ({value, label: `form.priceVisibilityOptions.${value}`}));

export const projectSheetView: ViewConfig = {
    model: "projects",
    viewType: "sheet",
    sheetWidget: "#ProjectSheetView",
    accessModel: "projects",
    apiUrl: "/api/realEstate/project",
    header: {
        titleField: "name",
        subtitleKey: "project",
        showCloseButton: true,
    },
    nodes: [
        // ── Overview: the title already names the project (UX-03) ──
        {
            render: "#SheetGroup",
            permissions: { readAny: ["description"] },
            dependent: "description",
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "description" },
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
                    ]
                }
            ],
        },

        // ── Statistics (conditional on statistics object existing) ───
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
                            dependent: "statistics.totalEdifices",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.totalEdifices",
                                widget: "#DisplayCard",
                                label: "statistics.edifices",
                                widgetProps: {
                                    icon: "#Building",
                                    tooltip: "statistics.edificesTooltip",
                                    type: "number",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.totalFloors",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.totalFloors",
                                widget: "#DisplayCard",
                                label: "statistics.floors",
                                widgetProps: {
                                    icon: "#Layers",
                                    tooltip: "statistics.floorsTooltip",
                                    type: "number",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.totalUnits",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.totalUnits",
                                widget: "#DisplayCard",
                                label: "statistics.units",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    tooltip: "statistics.unitsTooltip",
                                    type: "number",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.totalArea",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.totalArea",
                                widget: "#DisplayCard",
                                label: "statistics.area",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    tooltip: "statistics.areaTooltip",
                                    format: "locale",
                                    suffix: "m²",
                                    type: "area",
                                     show: true,
                                 },
                            },
                        },
                        {
                            render: "div",
                            dependent: "statistics.totalInvestmentValue",
                            dependentRuntimeOnly: true,
                            children: [
                                {
                                    render: "#DisplayCard",
                                    field: {
                                        name: "statistics.totalInvestmentValue",
                                        widget: "#DisplayCard",
                                        label: "statistics.investment",
                                        widgetProps: {
                                            icon: "#IconChartArrowsVertical",
                                            tooltip: "statistics.investmentTooltip",
                                            valueType: "currencyList",
                                            andKey: "and",
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.unitsByStatus.available",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.unitsByStatus.available",
                                widget: "#DisplayCard",
                                label: "statistics.availableUnits",
                                widgetProps: {icon: "#CheckCircle", tooltip: "statistics.availableUnits", type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.unitsByStatus.reserved",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.unitsByStatus.reserved",
                                widget: "#DisplayCard",
                                label: "statistics.reservedUnits",
                                widgetProps: {icon: "#BookMarked", tooltip: "statistics.reservedUnits", type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.unitsByStatus.sold",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.unitsByStatus.sold",
                                widget: "#DisplayCard",
                                label: "statistics.soldUnits",
                                widgetProps: {icon: "#DollarSign", tooltip: "statistics.soldUnits", type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.unitsByStatus.leased",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.unitsByStatus.leased",
                                widget: "#DisplayCard",
                                label: "statistics.leasedUnits",
                                widgetProps: {icon: "#Key", tooltip: "statistics.leasedUnits", type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.unitsByStatus.unavailable",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "statistics.unitsByStatus.unavailable",
                                widget: "#DisplayCard",
                                label: "statistics.unavailableUnits",
                                widgetProps: {icon: "#XCircle", tooltip: "statistics.unavailableUnits", type: "number", show: true},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.totalUnitsArea",
                            dependentRuntimeOnly: true,
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
                            dependent: "statistics.totalUnitsNetArea",
                            dependentRuntimeOnly: true,
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
                            dependent: "statistics.totalUnitsSharedArea",
                            dependentRuntimeOnly: true,
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
                            dependent: "statistics.totalValue",
                            dependentRuntimeOnly: true,
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
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            dependent: "statistics.collectedAmount",
                            dependentRuntimeOnly: true,
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
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            dependent: "statistics.notCollectedAmount",
                            dependentRuntimeOnly: true,
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
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            dependent: "statistics.verifiedPaidUnitCosts",
                            dependentRuntimeOnly: true,
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
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            dependent: "statistics.verifiedOutstandingUnitCosts",
                            dependentRuntimeOnly: true,
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
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "div",
                            dependent: "statistics.pendingVerificationUnitCosts",
                            dependentRuntimeOnly: true,
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
                                             show: true,
                                         },
                                    },
                                },
                            ],
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "statistics.totalUnitCostDocuments",
                            dependentRuntimeOnly: true,
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

        // Sections that modules building on propertyManagement contribute (the development hub: open snags, contracts,
        // claims): related records and work to act on, so right after the key facts and before the secondary details
        // (UX-03, D151, TD-F137). Each checks its own models' access.
        {render: "#ProjectContributedSections", field: {name: "_id", widget: "#ProjectContributedSections"}},

        // ── Commissions: secondary (UX-03) ──────────────────────────
        {
            render: "#SheetGroup",
            permissions: {
                readAny: ["saleCommissionRatePercent", "reservationCommissionRatePercent"],
            },
            dependentAny: ["saleCommissionRatePercent", "reservationCommissionRatePercent"],
            props: { title: "commissions" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "saleCommissionRatePercent" },
                            dependent: "saleCommissionRatePercent",
                            field: {
                                name: "saleCommissionRatePercent",
                                widget: "#DisplayCard",
                                label: "saleCommission",
                                widgetProps: { icon: "#Percent", suffix: "%", tooltip: "saleCommissionTooltip" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "reservationCommissionRatePercent" },
                            dependent: "reservationCommissionRatePercent",
                            field: {
                                name: "reservationCommissionRatePercent",
                                widget: "#DisplayCard",
                                label: "reservationCommission",
                                widgetProps: { icon: "#Percent", suffix: "%", tooltip: "reservationCommissionTooltip" },
                            },
                        },
                    ],
                },
            ],
        },

        // ── Social links ─────────────────────────────────────────────
        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "project.sheet.socialLinks.listDisplay",
                defaultMode: "cards",
            },
            children: [
                {
                    render: "#SheetGroup",
                    props: {
                        title: "socialLinks",
                        titleActions: "#ReferencesViewModeToggle",
                        defaultOpen: false,
                    },
                    permissions: { readAny: ["socialLinks"] },
                    dependent: "socialLinks",
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: { read: "socialLinks" },
                                    field: {
                                        name: "socialLinks",
                                        widget: "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 10,
                                            compactSummaryFields: ["name", "link"],
                                            fields: [
                                                { name: "logo", type: "mediaStrip", labelKey: "socialLinkLogo" },
                                                { name: "name", type: "text", className: "text-sm font-medium", labelKey: "socialLinkName" },
                                                { name: "link", type: "url", className: "text-sm", labelKey: "socialLinkUrl" },
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

        // ── Gallery ──────────────────────────────────────────────────
        {
            render: "#SheetGroup",
            permissions: { readAny: ["mainImage", "imageGallery", "videoGallery"] },
            dependentAny: ["mainImage", "imageGallery", "videoGallery"],
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
            dependent: "mediaFiles",
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
            dependent: "marketingBooklet",
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

        // ── Magazine ─────────────────────────────────────────────────
        {
            render: "#SheetGroup",
            permissions: { readAny: ["magazineTitle", "magazineDescription", "magazineFile"] },
            dependentAny: ["magazineTitle", "magazineDescription", "magazineFile"],
            props: { title: "magazine" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "magazineTitle" },
                            dependent: "magazineTitle",
                            field: {
                                name: "magazineTitle",
                                widget: "#DisplayCard",
                                label: "magazineTitle",
                                widgetProps: { icon: "#IconLabel" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "magazineDescription" },
                            dependent: "magazineDescription",
                            field: {
                                name: "magazineDescription",
                                widget: "#DisplayCard",
                                label: "magazineDescription",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "magazineFile" },
                            dependent: "magazineFile",
                            field: {
                                name: "magazineFile",
                                widget: "#DisplayCard",
                                label: "magazineFile",
                                widgetProps: {
                                    icon: "#Paperclip",
                                    type: "media",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        // ── Visibility: on the homepage and the public price (UX-04) ─
        {
            render: "#SheetGroup",
            permissions: { readAny: ["featuredOnHomepage", "priceVisibility"] },
            props: { title: "visibilityGroup" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "featuredOnHomepage" },
                            dependent: "featuredOnHomepage",
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
                            permissions: { read: "priceVisibility" },
                            field: {
                                name: "priceVisibility",
                                widget: "#DisplayCard",
                                label: "priceVisibility",
                                widgetProps: {
                                    icon: "#EyeOff",
                                    tooltip: "priceVisibilityTooltip",
                                    languageKeyCategory: "priceVisibilityEnum", type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "priceVisibility" },
                            // Resolved on the single read; not a stored field.
                            dependent: "effectivePriceVisibility",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "effectivePriceVisibility.key",
                                widget: "#DisplayCard",
                                label: "effectivePriceVisibility",
                                skipReadAccessGate: true,
                                widgetProps: {
                                    icon: "#Eye",
                                    tooltip: "effectivePriceVisibilityTooltip",
                                    languageKeyCategory: "effectivePriceVisibilityEnum", type: "enum",
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

const projectCreateFormNode: ViewConfig["nodes"] = [
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
                            widgetProps: { maxLength: PROJECT_SHORT_TEXT_MAX },
                        },
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
                                maxLength: PROJECT_LONG_TEXT_MAX,
                            },
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

    // ── Magazine (journal PDF + copy) ───────────────────────────
    {
        render: "#TitleWithCollapse",
        props: { title: "form.magazineSectionTitle" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 1 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "magazineTitle",
                            widget: "#Input",
                            label: "form.magazineTitleLabel",
                            placeholder: "form.magazineTitlePlaceholder",
                            widgetProps: { maxLength: PROJECT_SHORT_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "magazineDescription",
                            widget: "#Textarea",
                            label: "form.magazineDescriptionLabel",
                            placeholder: "form.magazineDescriptionPlaceholder",
                            widgetProps: {
                                className:
                                    "min-h-[120px] max-h-[280px] w-full resize-y overflow-y-auto leading-relaxed",
                                maxLength: PROJECT_LONG_TEXT_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "magazineFile",
                            widget: "#MediaField",
                            label: "form.magazineFileLabel",
                            widgetProps: { mediaType: "file", mode: "single", maxCount: 1, accept: "application/pdf,.pdf" },
                        },
                    },
                ],
            },
        ],
    },

    // ── Social / follow links ───────────────────────────────────
    {
        render: "#Field",
        field: {
            name: "socialLinks",
            widget: "#FormRepeater",
            widgetProps: {
                title: "form.socialLinksSectionTitle",
                arrayField: "socialLinks",
                defaultItem: { name: "", link: "" },
                addLabel: "form.socialLinkAddRow",
                removeLabel: "form.socialLinkRemoveRow",
                rowTitleFields: ["name"],
                rowTitlePlaceholder: "form.socialLinkRowTitle",
                rowTemplate: [
                    {
                        render: "div",
                        props: { className: "space-y-4" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "name",
                                    widget: "#Input",
                                    label: "form.socialLinkNameLabel",
                                    placeholder: "form.socialLinkNamePlaceholder",
                                    required: true,
                                    widgetProps: { maxLength: PROJECT_SHORT_TEXT_MAX },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "link",
                                    widget: "#Input",
                                    label: "form.socialLinkUrlLabel",
                                    placeholder: "form.socialLinkUrlPlaceholder",
                                    required: true,
                                    widgetProps: { type: "url", maxLength: PROJECT_URL_MAX },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "logo",
                                    widget: "#MediaField",
                                    label: "form.socialLinkLogoLabel",
                                    widgetProps: { mediaType: "image", mode: "single" },
                                },
                            },
                        ],
                    },
                ],
            },
        },
    },
    // ── Visibility: on the homepage and the public price, last (UX-04) ─
    {
        render: "#TitleWithCollapse",
        props: { title: "form.visibilitySectionTitle" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
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
                    {
                        render: "#Field",
                        field: {
                            name: "priceVisibility",
                            widget: "#SimpleSelect",
                            label: "form.priceVisibilityLabel",
                            placeholder: "form.priceVisibilityPlaceholder",
                            widgetProps: { options: priceVisibilityOptions, className: "grow w-full" },
                        },
                    },
                ],
            },
        ],
    },
];

const projectEditFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        permissions: {
            readAny: ["name", "description"],
            writeAny: ["name", "description"],
        },
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
                            widgetProps: { maxLength: PROJECT_SHORT_TEXT_MAX },
                        }, permissions: {read: "name", write: "name"},
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
                                maxLength: PROJECT_LONG_TEXT_MAX,
                            },
                        }, permissions: {read: "description", write: "description"},
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
                            widgetProps: { type: "decimal", min: 0, max: 100, step: "0.0001" },
                        }, permissions: {read: "saleCommissionRatePercent", write: "saleCommissionRatePercent"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reservationCommissionRatePercent",
                            widget: "#Input",
                            label: "form.reservationCommissionRateLabel",
                            placeholder: "form.reservationCommissionRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: "0.0001" },
                        }, permissions: {read: "reservationCommissionRatePercent", write: "reservationCommissionRatePercent"},
                    },
                ],
            },
        ],
    },

    // ── Main image (single image picker) ────────────────────────
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
                }, permissions: {write: "mainImage", read: "mainImage"},
            },
        ],
    },

    // ── Image gallery (multiple image picker) ───────────────────
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
                }, permissions: {write: "imageGallery", read: "imageGallery"},
            },
        ],
    },

    // ── Video gallery (multiple video picker) ───────────────────
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

    // ── Magazine (journal PDF + copy) ───────────────────────────
    {
        render: "#TitleWithCollapse",
        props: { title: "form.magazineSectionTitle" },
        permissions: {
            readAny: ["magazineTitle", "magazineDescription", "magazineFile"],
            writeAny: ["magazineTitle", "magazineDescription", "magazineFile"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 1 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "magazineTitle",
                            widget: "#Input",
                            label: "form.magazineTitleLabel",
                            placeholder: "form.magazineTitlePlaceholder",
                            widgetProps: { maxLength: PROJECT_SHORT_TEXT_MAX },
                        }, permissions: {read: "magazineTitle", write: "magazineTitle"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "magazineDescription",
                            widget: "#Textarea",
                            label: "form.magazineDescriptionLabel",
                            placeholder: "form.magazineDescriptionPlaceholder",
                            widgetProps: {
                                className:
                                    "min-h-[120px] max-h-[280px] w-full resize-y overflow-y-auto leading-relaxed",
                                maxLength: PROJECT_LONG_TEXT_MAX,
                            },
                        }, permissions: {read: "magazineDescription", write: "magazineDescription"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "magazineFile",
                            widget: "#MediaField",
                            label: "form.magazineFileLabel",
                            widgetProps: { mediaType: "file", mode: "single", maxCount: 1, accept: "application/pdf,.pdf" },
                        }, permissions: {read: "magazineFile", write: "magazineFile"},
                    },
                ],
            },
        ],
    },

    // ── Social / follow links ───────────────────────────────────
    {
        render: "#Field",
        permissions: { readAny: ["socialLinks"], writeAny: ["socialLinks"] },
        field: {
            name: "socialLinks",
            widget: "#FormRepeater",
            widgetProps: {
                title: "form.socialLinksSectionTitle",
                arrayField: "socialLinks",
                defaultItem: { name: "", link: "" },
                addLabel: "form.socialLinkAddRow",
                removeLabel: "form.socialLinkRemoveRow",
                rowTitleFields: ["name"],
                rowTitlePlaceholder: "form.socialLinkRowTitle",
                rowTemplate: [
                    {
                        render: "div",
                        props: { className: "space-y-4" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "name",
                                    widget: "#Input",
                                    label: "form.socialLinkNameLabel",
                                    placeholder: "form.socialLinkNamePlaceholder",
                                    required: true,
                                    widgetProps: { maxLength: PROJECT_SHORT_TEXT_MAX },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "link",
                                    widget: "#Input",
                                    label: "form.socialLinkUrlLabel",
                                    placeholder: "form.socialLinkUrlPlaceholder",
                                    required: true,
                                    widgetProps: { type: "url", maxLength: PROJECT_URL_MAX },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "logo",
                                    widget: "#MediaField",
                                    label: "form.socialLinkLogoLabel",
                                    widgetProps: { mediaType: "image", mode: "single" },
                                },
                            },
                        ],
                    },
                ],
            },
        },
    },
    // ── Visibility: on the homepage and the public price, last (UX-04) ─
    {
        render: "#TitleWithCollapse",
        props: { title: "form.visibilitySectionTitle" },
        permissions: {
            readAny: ["featuredOnHomepage", "featuredSortOrder", "priceVisibility"],
            writeAny: ["featuredOnHomepage", "featuredSortOrder", "priceVisibility"],
        },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
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
                    {
                        render: "#Field",
                        field: {
                            name: "priceVisibility",
                            widget: "#SimpleSelect",
                            label: "form.priceVisibilityLabel",
                            placeholder: "form.priceVisibilityPlaceholder",
                            widgetProps: { options: priceVisibilityOptions, className: "grow w-full" },
                        }, permissions: {read: "priceVisibility", write: "priceVisibility"},
                    },
                ],
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
    nodes: projectCreateFormNode,
};

export const projectEditFormView: ViewConfig = {
    model: "projects",
    viewType: "form",
    viewMode: "edit",
    accessModel: "projects",
    apiUrl: "/api/realEstate/project",
    method: "PATCH",
    nodes: projectEditFormNode,
};

export const projectViews: ViewConfig[] = [projectSheetView, projectCreateFormView, projectEditFormView];
