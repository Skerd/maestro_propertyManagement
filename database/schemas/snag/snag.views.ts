import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

const SNAG_SEVERITY_OPTIONS = [
    {value: "low",      label: "form.severityLow"},
    {value: "medium",   label: "form.severityMedium"},
    {value: "high",     label: "form.severityHigh"},
    {value: "critical", label: "form.severityCritical"},
] as const;

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
                            render: "#SmallInfoCard",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#SmallInfoCard",
                                label: "name",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "title"},
                            field: {
                                name: "title",
                                widget: "#SmallInfoCard",
                                label: "title",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "unit"},
                            field: {
                                name: "unit.name",
                                widget: "#SmallInfoCard",
                                label: "unit",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    linkedRefPath: "unit",
                                    linkedSheetModel: "units",
                                    linkedSheetWidget: "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "location"},
                            field: {
                                name: "location",
                                widget: "#SmallInfoCard",
                                label: "location",
                                widgetProps: {icon: "#MapPin"},
                            },
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
                                    languageKeyCategory: "statuses",
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
                            render: "#SmallInfoCard",
                            permissions: {read: "severity"},
                            field: {
                                name: "severity",
                                widget: "#SmallInfoCard",
                                label: "severity",
                                widgetProps: {
                                    icon: "#AlertTriangle",
                                    languageKeyCategory: "severities",
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
                            render: "#SmallInfoCard",
                            permissions: {read: "reportedBy"},
                            field: {
                                name: "reportedBy",
                                widget: "#SmallInfoCard",
                                label: "reportedBy",
                                widgetProps: {
                                    icon: "#IconUser",
                                    parent: "reportedBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "assignedTo"},
                            field: {
                                name: "assignedTo",
                                widget: "#SmallInfoCard",
                                label: "assignedTo",
                                widgetProps: {
                                    icon: "#IconUserCheck",
                                    parent: "assignedTo",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "dueDate"},
                            field: {
                                name: "dueDate",
                                widget: "#SmallInfoCard",
                                label: "dueDate",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "resolvedAt"},
                            dependent: "resolvedAt",
                            field: {
                                name: "resolvedAt",
                                widget: "#SmallInfoCard",
                                label: "resolvedAt",
                                widgetProps: {icon: "#CalendarCheck", format: "date"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "description"},
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "description"},
                            field: {
                                name: "description",
                                widget: "#ExpandableText",
                                widgetProps: {className: "text-sm"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "notes"},
            dependent: "notes",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "notes"},
                            field: {
                                name: "notes",
                                widget: "#ExpandableText",
                                widgetProps: {className: "text-sm"},
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
    ],
};

const snagFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
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
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "location",
                            widget: "#Input",
                            label: "form.locationLabel",
                            placeholder: "form.locationPlaceholder",
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
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
                    widgetProps: {className: "resize-none max-h-[250px] overflow-y-auto"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"},
                },
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
