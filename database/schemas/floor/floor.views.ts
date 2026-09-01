import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    FLOOR_LONG_TEXT_MAX,
    FLOOR_SHARED_SPACE_ITEM_MAX,
    FLOOR_SHARED_SPACE_MAX_ITEMS,
    FLOOR_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/floor/floor.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
            permissions: {
                readAny: [
                    "name",
                    "edifice",
                    "levelNumber",
                    "totalUnits",
                    "area",
                    "isAccessible",
                    "hasEmergencyExit",
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
                            permissions: { read: "edifice" },
                            field: {
                                name: "edifice.name",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: { read: "levelNumber" },
                            field: {
                                name: "levelNumber",
                                widget: "#DisplayCard",
                                label: "levelNumber",
                                widgetProps: { icon: "#Layers" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "totalUnits" },
                            field: {
                                name: "totalUnits",
                                widget: "#DisplayCard",
                                label: "totalUnits",
                                widgetProps: { icon: "#DoorOpen" , type: "number"},
                            },
                        },
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
                            permissions: { read: "isAccessible" },
                            field: {
                                name: "isAccessible",
                                widget: "#DisplayCard",
                                label: "isAccessible",
                                widgetProps: { icon: "#Accessibility", valueType: "boolean" , type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "hasEmergencyExit" },
                            field: {
                                name: "hasEmergencyExit",
                                widget: "#DisplayCard",
                                label: "hasEmergencyExit",
                                widgetProps: { icon: "#ShieldAlert", valueType: "boolean" , type: "boolean"},
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
            permissions: { readAny: ["sharedSpaces"] },
            props: { title: "sharedSpaces" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "sharedSpaces" },
                            field: {
                                name: "sharedSpaces",
                                widget: "#DisplayCard",
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
            permissions: { readAny: ["mainImage", "imageGallery", "videoGallery"] },
            props: { title: "gallery" },
            children: [
                {
                    render: "div",
                    props: { className: "max-w-full" },
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

const floorCreateFormNode: ViewConfig["nodes"] = [
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
                        field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", widgetProps: {apiUrl: "/api/realEstate/project/select", pageSize: 50, cascadeClearFormFields: ["edifice"]}},
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
                            widgetProps: { maxLength: FLOOR_SHORT_TEXT_MAX },
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
                    widgetProps: {
                        className: "resize-none max-h-[250px] overflow-y-auto",
                        maxLength: FLOOR_LONG_TEXT_MAX,
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "floorLocation" },
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
        children: [
            {
                render: "#Field",
                field: {
                    name: "sharedSpaces",
                    widget: "#StringArrayField",
                    label: "form.sharedSpacesLabel",
                    placeholder: "form.sharedSpacesPlaceholder",
                    widgetProps: {
                        removeTooltipKey: "removeSharedSpace",
                        maxItems: FLOOR_SHARED_SPACE_MAX_ITEMS,
                        maxLength: FLOOR_SHARED_SPACE_ITEM_MAX,
                    },
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

const floorEditFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        permissions: {
            readAny: ["project", "edifice", "name", "levelNumber", "area", "description"],
            writeAny: ["project", "edifice", "name", "levelNumber", "area", "description"],
        },
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
                        }, permissions: {read: "project"},
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
                        }, permissions: {read: "edifice", write: "edifice"},
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
                            widgetProps: { maxLength: FLOOR_SHORT_TEXT_MAX },
                        }, permissions: {read: "name", write: "name"},
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
                        }, permissions: {read: "levelNumber", write: "levelNumber"},
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
                        }, permissions: {read: "area", write: "area"},
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
                        maxLength: FLOOR_LONG_TEXT_MAX,
                    },
                }, permissions: {read: "description", write: "description"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "floorLocation" },
        permissions: { readAny: ["polygonCoordinates"], writeAny: ["polygonCoordinates"] },
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
                }, permissions: {read: "polygonCoordinates", write: "polygonCoordinates"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "sharedSpaces" },
        permissions: { readAny: ["sharedSpaces"], writeAny: ["sharedSpaces"] },
        children: [
            {
                render: "#Field",
                field: {
                    name: "sharedSpaces",
                    widget: "#StringArrayField",
                    label: "form.sharedSpacesLabel",
                    placeholder: "form.sharedSpacesPlaceholder",
                    widgetProps: {
                        removeTooltipKey: "removeSharedSpace",
                        maxItems: FLOOR_SHARED_SPACE_MAX_ITEMS,
                        maxLength: FLOOR_SHARED_SPACE_ITEM_MAX,
                    },
                }, permissions: {read: "sharedSpaces", write: "sharedSpaces"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "features" },
        permissions: {
            readAny: ["isAccessible", "hasEmergencyExit"],
            writeAny: ["isAccessible", "hasEmergencyExit"],
        },
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
                        }, permissions: {read: "isAccessible", write: "isAccessible"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "hasEmergencyExit",
                            widget: "#Switch",
                            label: "form.hasEmergencyExitLabel",
                        }, permissions: {read: "hasEmergencyExit", write: "hasEmergencyExit"},
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

export const floorCreateFormView: ViewConfig = {
    model: "floors",
    viewType: "form",
    viewMode: "create",
    accessModel: "floors",
    apiUrl: "/api/realEstate/floor",
    method: "PUT",
    nodes: floorCreateFormNode,
};

export const floorEditFormView: ViewConfig = {
    model: "floors",
    viewType: "form",
    viewMode: "edit",
    accessModel: "floors",
    apiUrl: "/api/realEstate/floor",
    method: "PATCH",
    nodes: floorEditFormNode,
};

export const floorViews: ViewConfig[] = [
    floorSheetView,
    floorCreateFormView,
    floorEditFormView,
];
