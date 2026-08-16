import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
                            render: "#DisplayCard",
                            permissions: {read: "requiresSaleApproval"},
                            field: {
                                name: "requiresSaleApproval",
                                widget: "#DisplayCard",
                                label: "requiresSaleApproval",
                                widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "requiresSaleApproval"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "requiresHandoverPackageForHandover"},
                            field: {
                                name: "requiresHandoverPackageForHandover",
                                widget: "#DisplayCard",
                                label: "requiresHandoverPackageForHandover",
                                widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "requiresHandoverPackageForHandover"},
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
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
