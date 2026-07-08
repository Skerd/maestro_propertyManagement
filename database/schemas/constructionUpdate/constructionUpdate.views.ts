import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const constructionUpdateSheetView: ViewConfig = {
    model: "constructionupdates",
    viewType: "sheet",
    accessModel: "constructionupdates",
    apiUrl: "/api/realEstate/constructionUpdate",
    header: {
        titleField: "title",
        subtitleKey: "constructionUpdate",
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
                            permissions: {read: "progressPercent"},
                            field: {
                                name: "progressPercent",
                                widget: "#SmallInfoCard",
                                label: "progressPercent",
                                widgetProps: {icon: "#Percent", suffix: "%"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "updateDate"},
                            field: {
                                name: "updateDate",
                                widget: "#SmallInfoCard",
                                label: "updateDate",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
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

const constructionUpdateFormNodes: ViewConfig["nodes"] = [
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
                            name: "progressPercent",
                            widget: "#Input",
                            label: "form.progressPercentLabel",
                            placeholder: "form.progressPercentPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "updateDate",
                            widget: "#DateInput",
                            label: "form.updateDateLabel",
                            placeholder: "form.updateDatePlaceholder",
                            required: true,
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

export const constructionUpdateCreateFormView: ViewConfig = {
    model: "constructionupdates",
    viewType: "form",
    viewMode: "create",
    accessModel: "constructionupdates",
    apiUrl: "/api/realEstate/constructionUpdate",
    method: "PUT",
    nodes: constructionUpdateFormNodes,
};

export const constructionUpdateEditFormView: ViewConfig = {
    model: "constructionupdates",
    viewType: "form",
    viewMode: "edit",
    accessModel: "constructionupdates",
    apiUrl: "/api/realEstate/constructionUpdate",
    method: "PATCH",
    nodes: constructionUpdateFormNodes,
};

export const constructionUpdateViews: ViewConfig[] = [
    constructionUpdateSheetView,
    constructionUpdateCreateFormView,
    constructionUpdateEditFormView,
];
