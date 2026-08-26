import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    STORY_CONTENT_MAX,
    STORY_EXCERPT_MAX,
    STORY_TITLE_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/story.schema-def";
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
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            field: {
                                name: "project.name",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: {read: "edifice"},
                            dependent: "edifice",
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
                            permissions: {read: "unit"},
                            dependent: "unit",
                            field: {
                                name: "unit.name",
                                widget: "#DisplayCard",
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
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "storyType"},
                            field: {
                                name: "storyType.name",
                                widget: "#DisplayCard",
                                label: "storyType",
                                widgetProps: {
                                    icon: "#Tag",
                                    linkedRefPath: "storyType",
                                    linkedSheetModel: "storytypes",
                                    linkedSheetWidget: "#StoryTypeSheetView",
                                    linkedSheetEntityProp: "storyType",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "publishedAt"},
                            dependent: "publishedAt",
                            field: {
                                name: "publishedAt",
                                widget: "#DisplayCard",
                                label: "publishedAt",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "sortOrder"},
                            field: {
                                name: "sortOrder",
                                widget: "#DisplayCard",
                                label: "sortOrder",
                                widgetProps: {icon: "#ListOrdered", type: "number"},
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "published"},
                            field: {
                                name: "published",
                                widget: "#DisplayCard",
                                label: "published",
                                widgetProps: {icon: "#IconLabel", format: "boolean", type: "boolean"},
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
                            permissions: {read: "title"},
                            field: {
                                name: "title",
                                widget: "#DisplayCard",
                                label: "title",
                                widgetProps: {icon: "#IconLabel"},
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
                            permissions: {read: "excerpt"},
                            dependent: "excerpt",
                            field: {
                                name: "excerpt",
                                widget: "#DisplayCard",
                                label: "excerpt",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
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
                            permissions: {read: "content"},
                            field: {
                                name: "content",
                                widget: "#DisplayCard",
                                label: "content",
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
            props: {title: "gallery"},
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
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
                props: {columns: 3},
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
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "storyType",
                            widget: "#ApiSelect",
                            label: "form.storyTypeLabel",
                            placeholder: "form.storyTypePlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/storyType/select",
                                method: "POST",
                                pageSize: 50,
                            },
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
                            name: "publishedAt",
                            widget: "#DateInput",
                            label: "form.publishedAtLabel",
                            placeholder: "form.publishedAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                ]
            },
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: { maxLength: STORY_TITLE_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "excerpt",
                            widget: "#Textarea",
                            label: "form.excerptLabel",
                            placeholder: "form.excerptPlaceholder",
                            widgetProps: {
                                className: "field-sizing-fixed resize-none max-h-[250px] overflow-y-auto",
                                style: { maxHeight: 250 },
                                maxLength: STORY_EXCERPT_MAX,
                            },
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
                            widgetProps: {
                                className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                style: { maxHeight: 250 },
                                maxLength: STORY_CONTENT_MAX,
                            },
                        },
                    },
                ]
            },
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "published",
                            widget: "#Switch",
                            label: "form.publishedLabel",
                        },
                    },
                ]
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
