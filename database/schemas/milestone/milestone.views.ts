import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const milestoneSheetView: ViewConfig = {
    model: "milestones",
    viewType: "sheet",
    accessModel: "milestones",
    apiUrl: "/api/realEstate/milestone",
    header: {
        titleField: "title",
        subtitleKey: "milestone",
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
                                        planned: "secondary",
                                        in_progress: "warning",
                                        completed: "success",
                                        delayed: "destructive",
                                        cancelled: "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "weightPercent"},
                            dependent: "weightPercent",
                            field: {
                                name: "weightPercent",
                                widget: "#SmallInfoCard",
                                label: "weightPercent",
                                widgetProps: {icon: "#Percent", suffix: "%"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "plannedStart"},
                            field: {
                                name: "plannedStart",
                                widget: "#SmallInfoCard",
                                label: "plannedStart",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "plannedEnd"},
                            field: {
                                name: "plannedEnd",
                                widget: "#SmallInfoCard",
                                label: "plannedEnd",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "actualStart"},
                            dependent: "actualStart",
                            field: {
                                name: "actualStart",
                                widget: "#SmallInfoCard",
                                label: "actualStart",
                                widgetProps: {icon: "#CalendarCheck", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "actualEnd"},
                            dependent: "actualEnd",
                            field: {
                                name: "actualEnd",
                                widget: "#SmallInfoCard",
                                label: "actualEnd",
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
            props: {title: "media"},
            dependent: "media",
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
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
        lifecycleSheetGroup,
    ],
};

const milestoneFormNodes: ViewConfig["nodes"] = [
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
                                cascadeClearFormFields: ["edifice", "predecessors"],
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
                            name: "weightPercent",
                            widget: "#Input",
                            label: "form.weightPercentLabel",
                            placeholder: "form.weightPercentPlaceholder",
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "plannedStart",
                            widget: "#DateInput",
                            label: "form.plannedStartLabel",
                            placeholder: "form.plannedStartPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "plannedEnd",
                            widget: "#DateInput",
                            label: "form.plannedEndLabel",
                            placeholder: "form.plannedEndPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "predecessors",
                    widget: "#ApiSelect",
                    label: "form.predecessorsLabel",
                    placeholder: "form.predecessorsPlaceholder",
                    widgetProps: {
                        apiUrl: "/api/realEstate/milestone/select",
                        pageSize: 50,
                        multiple: true,
                        showSelectedChips: true,
                        postBodyFromFormField: {field: "project", paramName: "project"},
                        remountKeyFormField: "project",
                        normalizeEmptyToUndefined: true,
                    },
                },
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

export const milestoneCreateFormView: ViewConfig = {
    model: "milestones",
    viewType: "form",
    viewMode: "create",
    accessModel: "milestones",
    apiUrl: "/api/realEstate/milestone",
    method: "PUT",
    nodes: milestoneFormNodes,
};

export const milestoneEditFormView: ViewConfig = {
    model: "milestones",
    viewType: "form",
    viewMode: "edit",
    accessModel: "milestones",
    apiUrl: "/api/realEstate/milestone",
    method: "PATCH",
    nodes: milestoneFormNodes,
};

export const milestoneViews: ViewConfig[] = [
    milestoneSheetView,
    milestoneCreateFormView,
    milestoneEditFormView,
];
