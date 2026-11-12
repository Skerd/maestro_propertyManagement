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
            // The title names the type; slug and sort order stay off the sheet (UX-03).
            render: "#SheetGroup",
            permissions: {readAny: ["description"]},
            dependent: "description",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "description"},
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

const storyTypeCreateFormNode: ViewConfig["nodes"] = [
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
                        render: "div",
                        props: {className: "md:col-span-2 space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
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
    // ── Visibility: the order on lists, last (UX-04) ─────────
    {
        render: "#TitleWithCollapse",
        props: {title: "form.visibilitySectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
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
                ],
            },
        ],
    },
];

const storyTypeEditFormNode: ViewConfig["nodes"] = [
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
                        permissions: {write: "name", read: "name"},
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
                        render: "div",
                        props: {className: "md:col-span-2 space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                permissions: {write: "description", read: "description"},
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
    // ── Visibility: the order on lists, last (UX-04) ─────────
    {
        render: "#TitleWithCollapse",
        props: {title: "form.visibilitySectionTitle"},
        permissions: {readAny: ["sortOrder"], writeAny: ["sortOrder"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        permissions: {write: "sortOrder", read: "sortOrder"},
                        field: {
                            name: "sortOrder",
                            widget: "#Input",
                            label: "form.sortOrderLabel",
                            placeholder: "form.sortOrderPlaceholder",
                            widgetProps: {type: "number"},
                        },
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
    nodes: storyTypeCreateFormNode,
};

export const storyTypeEditFormView: ViewConfig = {
    model: "storytypes",
    viewType: "form",
    viewMode: "edit",
    accessModel: "storyTypes",
    apiUrl: "/api/realEstate/storyType",
    method: "PATCH",
    nodes: storyTypeEditFormNode,
};

export const storyTypeViews: ViewConfig[] = [storyTypeSheetView, storyTypeCreateFormView, storyTypeEditFormView];
