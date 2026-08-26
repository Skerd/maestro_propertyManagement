import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    UNIT_TYPE_LONG_TEXT_MAX,
    UNIT_TYPE_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitType/unitType.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
                            render: "#DisplayCard",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: { icon: "#Tag" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "slug" },
                            field: {
                                name: "slug",
                                widget: "#DisplayCard",
                                label: "slug",
                                widgetProps: { icon: "#Hash" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "category" },
                            field: {
                                name: "category.name",
                                widget: "#DisplayCard",
                                label: "category",
                                widgetProps: {
                                    icon: "#Tag",
                                    linkedRefPath: "category",
                                    linkedSheetModel: "unitTypeCategories",
                                    linkedSheetWidget: "#UnitTypeCategorySheetView",
                                    linkedSheetEntityProp: "unitTypeCategory",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "group" },
                            field: {
                                name: "group",
                                widget: "#DisplayCard",
                                label: "group",
                                widgetProps: { icon: "#Building" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "isPrivate" },
                            field: {
                                name: "isPrivate",
                                widget: "#DisplayCard",
                                label: "isPrivate",
                                widgetProps: { icon: "#Lock", type: "boolean", languageKeyCategory: "unitTypeVisibility" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "icon" },
                            field: {
                                name: "icon",
                                widget: "#DisplayCard",
                                label: "icon",
                                widgetProps: { icon: "#Palette", type: "icon" },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "description" },
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
                            widgetProps: { maxLength: UNIT_TYPE_SHORT_TEXT_MAX },
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
                            widgetProps: { maxLength: UNIT_TYPE_SHORT_TEXT_MAX },
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
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: { maxHeight: 250 },
                                        maxLength: UNIT_TYPE_LONG_TEXT_MAX,
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
