import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    SNAG_LONG_TEXT_MAX,
    SNAG_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/snag/snag.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const SNAG_SEVERITY_OPTIONS = [
    {value: "low",      label: "form.severityLow"},
    {value: "medium",   label: "form.severityMedium"},
    {value: "high",     label: "form.severityHigh"},
    {value: "critical", label: "form.severityCritical"},
] as const;

const snagLongTextareaProps = {
    className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
    style: {maxHeight: 250},
    maxLength: SNAG_LONG_TEXT_MAX,
} as const;

export const snagSheetView: ViewConfig = {
    model: "snags",
    viewType: "sheet",
    accessModel: "snags",
    apiUrl: "/api/realEstate/snag",
    header: {
        titleField: "title",
        subtitleKey: "snag",
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
                            dependent: "name",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: {icon: "#Tag"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "title"},
                            field: {
                                name: "title",
                                widget: "#DisplayCard",
                                label: "title",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "unit",
                            permissions: {read: "unit"},
                            field: {
                                name: "unit",
                                widget: "#DisplayCard",
                                label: "unit",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    linkedRefPath: "unit",
                                    linkedSheetModel: "units",
                                    linkedSheetWidget: "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                    parent: "unit",
                                    valuePath: ["name", "unitNumber", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "location"},
                            dependent: "location",
                            field: {
                                name: "location",
                                widget: "#DisplayCard",
                                label: "location",
                                widgetProps: {icon: "#MapPin"},
                            },
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
                                    languageKeyCategory: "statuses",
                                    type: "enum",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        open: "secondary",
                                        in_progress: "warning",
                                        resolved: "success",
                                        rejected: "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "severity"},
                            field: {
                                name: "severity",
                                widget: "#DisplayCard",
                                label: "severity",
                                widgetProps: {
                                    icon: "#AlertTriangle",
                                    languageKeyCategory: "severities",
                                    type: "enum",
                                    variantLookupField: "severity",
                                    variantLookupMap: {
                                        low: "secondary",
                                        medium: "warning",
                                        high: "destructive",
                                        critical: "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "reportedBy"},
                            dependent: "reportedBy",
                            field: {
                                name: "reportedBy",
                                widget: "#DisplayCard",
                                label: "reportedBy",
                                widgetProps: {
                                    icon: "#IconUser",
                                    parent: "reportedBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "assignedTo"},
                            dependent: "assignedTo",
                            field: {
                                name: "assignedTo",
                                widget: "#DisplayCard",
                                label: "assignedTo",
                                widgetProps: {
                                    icon: "#IconUserCheck",
                                    parent: "assignedTo",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "dueDate"},
                            dependent: "dueDate",
                            field: {
                                name: "dueDate",
                                widget: "#DisplayCard",
                                label: "dueDate",
                                widgetProps: {icon: "#CalendarDays", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "resolvedAt"},
                            dependent: "resolvedAt",
                            field: {
                                name: "resolvedAt",
                                widget: "#DisplayCard",
                                label: "resolvedAt",
                                widgetProps: {icon: "#CalendarCheck", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "trade"},
                            dependent: "trade",
                            field: {
                                name: "trade",
                                widget: "#DisplayCard",
                                label: "trade",
                                widgetProps: {icon: "#Tools"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "workPackage"},
                            dependent: "workPackage",
                            field: {
                                name: "workPackage",
                                widget: "#DisplayCard",
                                label: "workPackage",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "workPackage",
                                    linkedSheetModel: "workpackages",
                                    linkedSheetWidget: "#WorkPackageSheetView",
                                    linkedSheetEntityProp: "entity",
                                    parent: "workPackage",
                                    valuePath: ["title", "name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "costImpact"},
                            dependent: "costImpact",
                            field: {
                                name: "costImpact",
                                widget: "#DisplayCard",
                                label: "costImpact",
                                widgetProps: {icon: "#CurrencyDollar", format: "locale"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "isWarranty"},
                            field: {
                                name: "isWarranty",
                                widget: "#DisplayCard",
                                label: "isWarranty",
                                widgetProps: {icon: "#ShieldCheck", valueType: "boolean", type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "isDlp"},
                            field: {
                                name: "isDlp",
                                widget: "#DisplayCard",
                                label: "isDlp",
                                widgetProps: {icon: "#ShieldCheck", valueType: "boolean", type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "variationOrder"},
                            dependent: "variationOrder",
                            field: {
                                name: "variationOrder",
                                widget: "#DisplayCard",
                                label: "variationOrder",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "variationOrder",
                                    linkedSheetModel: "variationorders",
                                    linkedSheetWidget: "#VariationOrderSheetView",
                                    linkedSheetEntityProp: "entity",
                                    parent: "variationOrder",
                                    valuePath: ["title", "name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "description"},
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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "notes"},
                            dependent: "notes",
                            field: {
                                name: "notes",
                                widget: "#DisplayCard",
                                label: "notes",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "rootCause"},
                            dependent: "rootCause",
                            field: {
                                name: "rootCause",
                                widget: "#DisplayCard",
                                label: "rootCause",
                                widgetProps: {
                                    icon: "#AlertCircle",
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
            props: {title: "photos"},
            dependent: "photos",
            permissions: {read: "photos"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "photos"},
                            field: {
                                name: "photos",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "photos",
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: true,
                                    showPreviews: true,
                                    previewLocation: "right",
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

const snagFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        props: {skipRenderWhenFormExtraTruthy: "prefilledUnitId"},
                        field: {
                            name: "unit",
                            widget: "#ApiSelect",
                            label: "form.unitLabel",
                            placeholder: "form.unitPlaceholder",
                            required: true,
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                pageSize: 50,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: SNAG_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "location",
                            widget: "#Input",
                            label: "form.locationLabel",
                            placeholder: "form.locationPlaceholder",
                            widgetProps: {maxLength: SNAG_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "severity",
                            widget: "#SimpleSelect",
                            label: "form.severityLabel",
                            placeholder: "form.severityPlaceholder",
                            widgetProps: {options: [...SNAG_SEVERITY_OPTIONS]},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reportedBy",
                            widget: "#ApiSelect",
                            label: "form.reportedByLabel",
                            placeholder: "form.reportedByPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: {administration: true},
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "assignedTo",
                            widget: "#ApiSelect",
                            label: "form.assignedToLabel",
                            placeholder: "form.assignedToPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: {administration: true},
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "dueDate",
                            widget: "#DateInput",
                            label: "form.dueDateLabel",
                            placeholder: "form.dueDatePlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "trade",
                            widget: "#Input",
                            label: "form.tradeLabel",
                            placeholder: "form.tradePlaceholder",
                            widgetProps: {maxLength: SNAG_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "workPackage",
                            widget: "#ApiSelect",
                            label: "form.workPackageLabel",
                            placeholder: "form.workPackagePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/workPackage/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "variationOrder",
                            widget: "#ApiSelect",
                            label: "form.variationOrderLabel",
                            placeholder: "form.variationOrderPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/variationOrder/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "costImpact",
                            widget: "#Input",
                            label: "form.costImpactLabel",
                            placeholder: "form.costImpactPlaceholder",
                            widgetProps: {type: "number", step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "isWarranty",
                            widget: "#Checkbox",
                            label: "form.isWarrantyLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "isDlp",
                            widget: "#Checkbox",
                            label: "form.isDlpLabel",
                        },
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: snagLongTextareaProps,
                                },
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "notes",
                                    widget: "#Textarea",
                                    label: "form.notesLabel",
                                    placeholder: "form.notesPlaceholder",
                                    widgetProps: snagLongTextareaProps,
                                },
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "rootCause",
                                    widget: "#Textarea",
                                    label: "form.rootCauseLabel",
                                    placeholder: "form.rootCausePlaceholder",
                                    widgetProps: snagLongTextareaProps,
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "div",
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.photosLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "photos",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 20,
                                accept: "image/*",
                                existingListExtraKey: "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey: "form.newFiles",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const snagCreateFormView: ViewConfig = {
    model: "snags",
    viewType: "form",
    viewMode: "create",
    accessModel: "snags",
    apiUrl: "/api/realEstate/snag",
    method: "PUT",
    nodes: snagFormNodes,
};

export const snagEditFormView: ViewConfig = {
    model: "snags",
    viewType: "form",
    viewMode: "edit",
    accessModel: "snags",
    apiUrl: "/api/realEstate/snag",
    method: "PATCH",
    nodes: snagFormNodes,
};

export const snagViews: ViewConfig[] = [
    snagSheetView,
    snagCreateFormView,
    snagEditFormView,
];
