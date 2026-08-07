import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const storySheetView: ViewConfig = {
    model: "stories",
    viewType: "sheet",
    accessModel: "stories",
    apiUrl: "/api/realEstate/story",
    header: {
        titleField: "title",
        subtitleKey: "story",
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
                            permissions: {read: "published"},
                            field: {
                                name: "published",
                                widget: "#SmallInfoCard",
                                label: "published",
                                widgetProps: {icon: "#IconLabel", format: "boolean"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "publishedAt"},
                            dependent: "publishedAt",
                            field: {
                                name: "publishedAt",
                                widget: "#SmallInfoCard",
                                label: "publishedAt",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "sortOrder"},
                            field: {
                                name: "sortOrder",
                                widget: "#SmallInfoCard",
                                label: "sortOrder",
                                widgetProps: {icon: "#ListOrdered"},
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
                            permissions: {read: "unit"},
                            dependent: "unit",
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
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "excerpt"},
            dependent: "excerpt",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "excerpt"},
                            field: {
                                name: "excerpt",
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
            props: {title: "content"},
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "content"},
                            field: {
                                name: "content",
                                widget: "#ExpandableText",
                                widgetProps: {className: "text-sm whitespace-pre-wrap"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "mainImage"},
            dependent: "mainImage",
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "mainImage"},
                            field: {
                                name: "mainImage",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "mainImage",
                                    showThumbnails: false,
                                    allowFullScreen: true,
                                    coverAfterFirst: true,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "imageGallery"},
            dependent: "imageGallery",
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "imageGallery"},
                            field: {
                                name: "imageGallery",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "imageGallery",
                                    showThumbnails: true,
                                    allowFullScreen: true,
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
        {
            render: "#SheetGroup",
            props: {title: "videoGallery"},
            dependent: "videoGallery",
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "videoGallery"},
                            field: {
                                name: "videoGallery",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "videoGallery",
                                    showThumbnails: true,
                                    allowFullScreen: true,
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

const storyFormNodes: ViewConfig["nodes"] = [
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
                                cascadeClearFormFields: ["edifice", "unit"],
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
                                cascadeClearFormFields: ["unit"],
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unit",
                            widget: "#ApiSelect",
                            label: "form.unitLabel",
                            placeholder: "form.unitPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormFields: [
                                    {field: "project", paramName: "project"},
                                    {field: "edifice", paramName: "edifice"},
                                ],
                                remountKeyFormField: "edifice",
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
                            name: "sortOrder",
                            widget: "#Input",
                            label: "form.sortOrderLabel",
                            placeholder: "form.sortOrderPlaceholder",
                            widgetProps: {type: "number"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "published",
                            widget: "#Switch",
                            label: "form.publishedLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "publishedAt",
                            widget: "#DateInput",
                            label: "form.publishedAtLabel",
                            placeholder: "form.publishedAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "excerpt",
                    widget: "#Textarea",
                    label: "form.excerptLabel",
                    placeholder: "form.excerptPlaceholder",
                    widgetProps: {className: "resize-none max-h-[120px] overflow-y-auto"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "content",
                    widget: "#Textarea",
                    label: "form.contentLabel",
                    placeholder: "form.contentPlaceholder",
                    required: true,
                    widgetProps: {className: "resize-none min-h-[200px] max-h-[400px] overflow-y-auto"},
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.mainImageLabel"},
        permissions: {write: "mainImage"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "mainImage",
                    widget: "#MediaField",
                    label: "form.mainImageLabel",
                    widgetProps: {mediaType: "image", mode: "single"},
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.imageGalleryLabel"},
        permissions: {write: "imageGallery"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "imageGallery",
                    widget: "#MediaField",
                    label: "form.imageGalleryLabel",
                    widgetProps: {mediaType: "image", mode: "multiple", maxCount: 20},
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.videoGalleryLabel"},
        permissions: {write: "videoGallery"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "videoGallery",
                    widget: "#MediaField",
                    label: "form.videoGalleryLabel",
                    widgetProps: {mediaType: "video", mode: "multiple", maxCount: 10},
                },
            },
        ],
    },
];

export const storyCreateFormView: ViewConfig = {
    model: "stories",
    viewType: "form",
    viewMode: "create",
    accessModel: "stories",
    apiUrl: "/api/realEstate/story",
    method: "PUT",
    nodes: storyFormNodes,
};

export const storyEditFormView: ViewConfig = {
    model: "stories",
    viewType: "form",
    viewMode: "edit",
    accessModel: "stories",
    apiUrl: "/api/realEstate/story",
    method: "PATCH",
    nodes: storyFormNodes,
};

export const storyViews: ViewConfig[] = [
    storySheetView,
    storyCreateFormView,
    storyEditFormView,
];
