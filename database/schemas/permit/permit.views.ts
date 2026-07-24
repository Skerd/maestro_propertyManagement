import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

const PERMIT_TYPE_OPTIONS = [
    {value: "building",      label: "form.typeBuilding"},
    {value: "excavation",    label: "form.typeExcavation"},
    {value: "environmental", label: "form.typeEnvironmental"},
    {value: "fire",          label: "form.typeFire"},
    {value: "utility",       label: "form.typeUtility"},
    {value: "occupancy",     label: "form.typeOccupancy"},
    {value: "zoning",        label: "form.typeZoning"},
    {value: "other",         label: "form.typeOther"},
] as const;

export const permitSheetView: ViewConfig = {
    model: "permits",
    viewType: "sheet",
    accessModel: "permits",
    apiUrl: "/api/realEstate/permit",
    header: {
        titleField: "title",
        subtitleKey: "permit",
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
                            permissions: {read: "project"},
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
                            permissions: {read: "edifice"},
                            dependent: "edifice",
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
                            permissions: {read: "permitType"},
                            field: {
                                name: "permitType",
                                widget: "#SmallInfoCard",
                                label: "permitType",
                                widgetProps: {icon: "#IconLabel", languageKeyCategory: "permitTypes"},
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
                                        draft: "secondary",
                                        submitted: "info",
                                        under_review: "warning",
                                        approved: "success",
                                        rejected: "destructive",
                                        expired: "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "authority"},
                            dependent: "authority",
                            field: {
                                name: "authority",
                                widget: "#SmallInfoCard",
                                label: "authority",
                                widgetProps: {icon: "#IconBuildingBank"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "referenceNumber"},
                            dependent: "referenceNumber",
                            field: {
                                name: "referenceNumber",
                                widget: "#SmallInfoCard",
                                label: "referenceNumber",
                                widgetProps: {icon: "#IconHash"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "submittedAt"},
                            dependent: "submittedAt",
                            field: {
                                name: "submittedAt",
                                widget: "#SmallInfoCard",
                                label: "submittedAt",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "approvedAt"},
                            dependent: "approvedAt",
                            field: {
                                name: "approvedAt",
                                widget: "#SmallInfoCard",
                                label: "approvedAt",
                                widgetProps: {icon: "#CalendarCheck", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "expiresAt"},
                            dependent: "expiresAt",
                            field: {
                                name: "expiresAt",
                                widget: "#SmallInfoCard",
                                label: "expiresAt",
                                widgetProps: {icon: "#CalendarClock", format: "date"},
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
            props: {title: "media"},
            dependent: "media",
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "media"},
                            field: {
                                name: "media",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "media",
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

const permitFormNodes: ViewConfig["nodes"] = [
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
                        props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"},
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            required: true,
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
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
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
                            name: "permitType",
                            widget: "#SimpleSelect",
                            label: "form.permitTypeLabel",
                            placeholder: "form.permitTypePlaceholder",
                            required: true,
                            widgetProps: {options: [...PERMIT_TYPE_OPTIONS]},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "authority",
                            widget: "#Input",
                            label: "form.authorityLabel",
                            placeholder: "form.authorityPlaceholder",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "referenceNumber",
                            widget: "#Input",
                            label: "form.referenceNumberLabel",
                            placeholder: "form.referenceNumberPlaceholder",
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
                props: {title: "form.mediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "media",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 20,
                                accept: "image/*,application/pdf",
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

export const permitCreateFormView: ViewConfig = {
    model: "permits",
    viewType: "form",
    viewMode: "create",
    accessModel: "permits",
    apiUrl: "/api/realEstate/permit",
    method: "PUT",
    nodes: permitFormNodes,
};

export const permitEditFormView: ViewConfig = {
    model: "permits",
    viewType: "form",
    viewMode: "edit",
    accessModel: "permits",
    apiUrl: "/api/realEstate/permit",
    method: "PATCH",
    nodes: permitFormNodes,
};

export const permitViews: ViewConfig[] = [
    permitSheetView,
    permitCreateFormView,
    permitEditFormView,
];
