import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
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
                            render: "#SmallInfoCard",
                            permissions: {read: "slug"},
                            field: {
                                name: "slug",
                                widget: "#SmallInfoCard",
                                label: "slug",
                                widgetProps: {icon: "#Hash"},
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
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "description"},
            dependent: "description",
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "description"},
                            field: {
                                name: "description",
                                widget: "#ExpandableText",
                                label: "description",
                                widgetProps: {className: "text-sm"},
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
                                        className:
                                            "min-h-[140px] max-h-[320px] w-full resize-y overflow-y-auto leading-relaxed",
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
