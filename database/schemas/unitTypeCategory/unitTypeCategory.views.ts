import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

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
                    props: {columns: 1},
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#SmallInfoCard",
                                label: "name",
                                widgetProps: {icon: "#Tag"},
                            },
                        },
                    ],
                },
            ],
        },
    ],
};

const unitTypeCategoryFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1, className: "gap-x-4 gap-y-5"},
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
    nodes: unitTypeCategoryFormFields,
};

export const unitTypeCategoryEditFormView: ViewConfig = {
    model: "unittypecategories",
    viewType: "form",
    viewMode: "edit",
    accessModel: "unitTypeCategories",
    apiUrl: "/api/realEstate/unitTypeCategory",
    method: "PATCH",
    nodes: unitTypeCategoryFormFields,
};

export const unitTypeCategoryViews: ViewConfig[] = [
    unitTypeCategorySheetView,
    unitTypeCategoryCreateFormView,
    unitTypeCategoryEditFormView,
];
