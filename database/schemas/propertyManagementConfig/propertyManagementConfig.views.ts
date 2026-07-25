import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const propertyManagementConfigSheetView: ViewConfig = {
    model: "propertymanagementconfigs",
    viewType: "sheet",
    accessModel: "propertymanagementconfigs",
    apiUrl: "/api/realEstate/propertyManagementConfig",
    header: {titleField: "_id", subtitleKey: "propertyManagementConfig", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "requiresSaleApproval"},
                            field: {
                                name: "requiresSaleApproval",
                                widget: "#SmallInfoCard",
                                label: "requiresSaleApproval",
                                widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "requiresSaleApproval"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "requiresHandoverPackageForHandover"},
                            field: {
                                name: "requiresHandoverPackageForHandover",
                                widget: "#SmallInfoCard",
                                label: "requiresHandoverPackageForHandover",
                                widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "requiresHandoverPackageForHandover"},
                            },
                        },
                    ],
                },
            ],
        },
    ],
};

const formNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "requiresSaleApproval",
                            widget: "#Switch",
                            label: "form.requiresSaleApprovalLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "requiresHandoverPackageForHandover",
                            widget: "#Switch",
                            label: "form.requiresHandoverPackageForHandoverLabel",
                        },
                    },
                ],
            },
        ],
    },
];

export const propertyManagementConfigCreateFormView: ViewConfig = {
    model: "propertymanagementconfigs",
    viewType: "form",
    viewMode: "create",
    accessModel: "propertymanagementconfigs",
    apiUrl: "/api/realEstate/propertyManagementConfig",
    method: "PUT",
    nodes: formNodes,
};

export const propertyManagementConfigEditFormView: ViewConfig = {
    model: "propertymanagementconfigs",
    viewType: "form",
    viewMode: "edit",
    accessModel: "propertymanagementconfigs",
    apiUrl: "/api/realEstate/propertyManagementConfig",
    method: "PATCH",
    nodes: formNodes,
};

export const propertyManagementConfigViews: ViewConfig[] = [
    propertyManagementConfigSheetView,
    propertyManagementConfigCreateFormView,
    propertyManagementConfigEditFormView,
];
