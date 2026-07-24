import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const scheduleTaskSheetView: ViewConfig = {
    model: "scheduletasks",
    viewType: "sheet",
    accessModel: "scheduletasks",
    apiUrl: "/api/realEstate/scheduleTask",
    header: {
        titleField: "title",
        subtitleKey: "scheduleTask",
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
                            permissions: {read: "milestone"},
                            dependent: "milestone",
                            field: {
                                name: "milestone.title",
                                widget: "#SmallInfoCard",
                                label: "milestone",
                                widgetProps: {
                                    icon: "#Flag",
                                    linkedRefPath: "milestone",
                                    linkedSheetModel: "milestones",
                                    linkedSheetWidget: "#MilestoneSheetView",
                                    linkedSheetEntityProp: "milestone",
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
                            permissions: {read: "percentComplete"},
                            field: {
                                name: "percentComplete",
                                widget: "#SmallInfoCard",
                                label: "percentComplete",
                                widgetProps: {icon: "#Percent", suffix: "%"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "assignee"},
                            field: {
                                name: "assignee",
                                widget: "#SmallInfoCard",
                                label: "assignee",
                                widgetProps: {
                                    icon: "#IconUserCheck",
                                    parent: "assignee",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
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

const scheduleTaskFormNodes: ViewConfig["nodes"] = [
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
                                cascadeClearFormFields: ["edifice", "milestone"],
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
                            name: "milestone",
                            widget: "#ApiSelect",
                            label: "form.milestoneLabel",
                            placeholder: "form.milestonePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/milestone/select",
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
                            name: "assignee",
                            widget: "#ApiSelect",
                            label: "form.assigneeLabel",
                            placeholder: "form.assigneePlaceholder",
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
                            name: "percentComplete",
                            widget: "#Input",
                            label: "form.percentCompleteLabel",
                            placeholder: "form.percentCompletePlaceholder",
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                    },
                    {render: "#Field", field: {name: "dependencyType", widget: "#Select", label: "form.dependencyTypeLabel", placeholder: "form.dependencyTypePlaceholder", widgetProps: {options: [{value: "FS", label: "Finish-Start"}, {value: "SS", label: "Start-Start"}, {value: "FF", label: "Finish-Finish"}, {value: "SF", label: "Start-Finish"}], className: "grow w-full"}}},
                    {render: "#Field", field: {name: "lagDays", widget: "#Input", label: "form.lagDaysLabel", placeholder: "form.lagDaysPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "bkpCode", widget: "#Input", label: "form.bkpCodeLabel", placeholder: "form.bkpCodePlaceholder"}},
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

export const scheduleTaskCreateFormView: ViewConfig = {
    model: "scheduletasks",
    viewType: "form",
    viewMode: "create",
    accessModel: "scheduletasks",
    apiUrl: "/api/realEstate/scheduleTask",
    method: "PUT",
    nodes: scheduleTaskFormNodes,
};

export const scheduleTaskEditFormView: ViewConfig = {
    model: "scheduletasks",
    viewType: "form",
    viewMode: "edit",
    accessModel: "scheduletasks",
    apiUrl: "/api/realEstate/scheduleTask",
    method: "PATCH",
    nodes: scheduleTaskFormNodes,
};

export const scheduleTaskViews: ViewConfig[] = [
    scheduleTaskSheetView,
    scheduleTaskCreateFormView,
    scheduleTaskEditFormView,
];
