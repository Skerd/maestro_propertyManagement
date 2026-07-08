import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const unitTypeSheetView: ViewConfig = {
    model: "unittypes",
    viewType: "sheet",
    accessModel: "unitTypes",
    apiUrl: "/api/realEstate/unitType",
    header: {
        titleField: "name",
        subtitleKey: "unitType",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "slug" },
                            field: {
                                name: "slug",
                                widget: "#SmallInfoCard",
                                label: "slug",
                                widgetProps: { icon: "#Hash" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "category" },
                            field: {
                                name: "category",
                                widget: "#SmallInfoCard",
                                label: "category",
                                widgetProps: {icon: "#Tag", valuePath: ["name"]},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "group" },
                            field: {
                                name: "group",
                                widget: "#SmallInfoCard",
                                label: "group",
                                widgetProps: { icon: "#Building" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "isPrivate" },
                            field: {
                                name: "isPrivate",
                                widget: "#SmallInfoCard",
                                label: "isPrivate",
                                widgetProps: { icon: "#Lock", languageKeyCategory: "unitTypeVisibility" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "icon" },
                            field: {
                                name: "icon",
                                widget: "#SmallInfoCard",
                                label: "icon",
                                widgetProps: { icon: "#Palette", valueType: "mdiIcon" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "description" },
            dependent: "description",
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "description" },
                            field: {
                                name: "description",
                                widget: "#ExpandableText",
                                label: "description",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },
    ],
};

const unitTypeFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2, className: "gap-x-4 gap-y-5" },
                children: [
                    {
                        render: "#Field",
                        permissions: { write: "name" },
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
                        permissions: { write: "icon" },
                        field: {
                            name: "icon",
                            widget: "#IconPicker",
                            label: "form.iconLabel",
                            placeholder: "form.iconPlaceholder",
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "category" },
                        field: {
                            name: "category",
                            widget: "#ApiSelect",
                            label: "form.categoryLabel",
                            placeholder: "form.categoryPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/unitTypeCategory/select",
                                method: "POST",
                                pageSize: 50,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "group" },
                        field: {
                            name: "group",
                            widget: "#Input",
                            label: "form.groupLabel",
                            placeholder: "form.groupPlaceholder",
                        },
                    },
                    {
                        render: "div",
                        props: { className: "md:col-span-2 space-y-1.5" },
                        children: [
                            {
                                render: "#Field",
                                permissions: { write: "description" },
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
                    {
                        render: "div",
                        props: { className: "md:col-span-2 border-t border-border/60 pt-4 mt-1" },
                        children: [
                            {
                                render: "#Field",
                                permissions: { write: "isPrivate" },
                                field: {
                                    name: "isPrivate",
                                    widget: "#Checkbox",
                                    label: "form.isPrivateLabel",
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
];

export const unitTypeCreateFormView: ViewConfig = {
    model: "unittypes",
    viewType: "form",
    viewMode: "create",
    accessModel: "unitTypes",
    apiUrl: "/api/realEstate/unitType",
    method: "PUT",
    nodes: unitTypeFormFields,
};

export const unitTypeEditFormView: ViewConfig = {
    model: "unittypes",
    viewType: "form",
    viewMode: "edit",
    accessModel: "unitTypes",
    apiUrl: "/api/realEstate/unitType",
    method: "PATCH",
    nodes: unitTypeFormFields
};

export const unitTypeViews: ViewConfig[] = [unitTypeSheetView, unitTypeCreateFormView, unitTypeEditFormView];
