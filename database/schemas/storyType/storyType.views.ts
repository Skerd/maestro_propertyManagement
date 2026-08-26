import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    STORY_TYPE_DESCRIPTION_MAX,
    STORY_TYPE_NAME_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/storyType/storyType.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const storyTypeSheetView: ViewConfig = {
    model: "storytypes",
    viewType: "sheet",
    accessModel: "storyTypes",
    apiUrl: "/api/realEstate/storyType",
    header: {
        titleField: "name",
        subtitleKey: "storyType",
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
                            permissions: {read: "slug"},
                            field: {
                                name: "slug",
                                widget: "#DisplayCard",
                                label: "slug",
                                widgetProps: {icon: "#Hash"},
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
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const storyTypeFormFields: ViewConfig["nodes"] = [
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
                        permissions: {write: "name"},
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: {maxLength: STORY_TYPE_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "sortOrder"},
                        field: {
                            name: "sortOrder",
                            widget: "#Input",
                            label: "form.sortOrderLabel",
                            placeholder: "form.sortOrderPlaceholder",
                            widgetProps: {type: "number"},
                        },
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                permissions: {write: "description"},
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: STORY_TYPE_DESCRIPTION_MAX,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
];

export const storyTypeCreateFormView: ViewConfig = {
    model: "storytypes",
    viewType: "form",
    viewMode: "create",
    accessModel: "storyTypes",
    apiUrl: "/api/realEstate/storyType",
    method: "PUT",
    nodes: storyTypeFormFields,
};

export const storyTypeEditFormView: ViewConfig = {
    model: "storytypes",
    viewType: "form",
    viewMode: "edit",
    accessModel: "storyTypes",
    apiUrl: "/api/realEstate/storyType",
    method: "PATCH",
    nodes: storyTypeFormFields,
};

export const storyTypeViews: ViewConfig[] = [storyTypeSheetView, storyTypeCreateFormView, storyTypeEditFormView];
