import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {UNIT_TYPE_CATEGORY_NAME_MAX} from "armonia/src/modules/propertyManagement/api/realEstate/private/unitTypeCategory/unitTypeCategory.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const unitTypeCategorySheetView: ViewConfig = {
    model: "unittypecategories",
    viewType: "sheet",
    accessModel: "unitTypeCategories",
    apiUrl: "/api/realEstate/unitTypeCategory",
    header: {
        titleField: "name",
        subtitleKey: "unitTypeCategory",
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
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const unitTypeCategoryCreateFormNode: ViewConfig["nodes"] = [
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
                            widgetProps: {maxLength: UNIT_TYPE_CATEGORY_NAME_MAX},
                        },
                    },
                ],
            },
        ],
    },
];

const unitTypeCategoryEditFormNode: ViewConfig["nodes"] = [
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
                            widgetProps: {maxLength: UNIT_TYPE_CATEGORY_NAME_MAX},
                        },
                    },
                ],
            },
        ],
    },
];


export const unitTypeCategoryCreateFormView: ViewConfig = {
    model: "unittypecategories",
    viewType: "form",
    viewMode: "create",
    accessModel: "unitTypeCategories",
    apiUrl: "/api/realEstate/unitTypeCategory",
    method: "PUT",
    nodes: unitTypeCategoryCreateFormNode,
};

export const unitTypeCategoryEditFormView: ViewConfig = {
    model: "unittypecategories",
    viewType: "form",
    viewMode: "edit",
    accessModel: "unitTypeCategories",
    apiUrl: "/api/realEstate/unitTypeCategory",
    method: "PATCH",
    nodes: unitTypeCategoryEditFormNode,
};

export const unitTypeCategoryViews: ViewConfig[] = [
    unitTypeCategorySheetView,
    unitTypeCategoryCreateFormView,
    unitTypeCategoryEditFormView,
];
