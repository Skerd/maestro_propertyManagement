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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "listedOnPortal"},
                            field: {
                                name: "listedOnPortal",
                                widget: "#DisplayCard",
                                label: "listedOnPortal",
                                widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "listedOnPortal"},
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const propertyManagementConfigCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "notifications"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "notifyOnSales",
                            widget: "#ObjectIdChipsInput",
                            label: "form.notifyOnSalesLabel",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                placeholderKey: "form.selectUser",
                                removeTooltipKey: "form.removeUser",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "notifyOnSales",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "notifyOnReservations",
                            widget: "#ObjectIdChipsInput",
                            label: "form.notifyOnReservationsLabel",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                placeholderKey: "form.selectUser",
                                removeTooltipKey: "form.removeUser",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "notifyOnReservations",
                            },
                        },
                    },
                ],
            },
        ],
    },
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
                    {
                        render: "#Field",
                        field: {
                            name: "listedOnPortal",
                            widget: "#Switch",
                            label: "form.listedOnPortalLabel",
                        },
                    },
                ],
            },
        ],
    },
];

const propertyManagementConfigEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "notifications"},
        permissions: {readAny: ["notifyOnSales", "notifyOnReservations"], writeAny: ["notifyOnSales", "notifyOnReservations"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "notifyOnSales",
                            widget: "#ObjectIdChipsInput",
                            label: "form.notifyOnSalesLabel",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                placeholderKey: "form.selectUser",
                                removeTooltipKey: "form.removeUser",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "notifyOnSales",
                            },
                        },
                        permissions: {read: "notifyOnSales", write: "notifyOnSales"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "notifyOnReservations",
                            widget: "#ObjectIdChipsInput",
                            label: "form.notifyOnReservationsLabel",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                placeholderKey: "form.selectUser",
                                removeTooltipKey: "form.removeUser",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "notifyOnReservations",
                            },
                        },
                        permissions: {read: "notifyOnReservations", write: "notifyOnReservations"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {readAny: ["requiresSaleApproval", "requiresHandoverPackageForHandover", "listedOnPortal"], writeAny: ["requiresSaleApproval", "requiresHandoverPackageForHandover", "listedOnPortal"]},
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
                        permissions: {read: "requiresSaleApproval", write: "requiresSaleApproval"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "requiresHandoverPackageForHandover",
                            widget: "#Switch",
                            label: "form.requiresHandoverPackageForHandoverLabel",
                        },
                        permissions: {read: "requiresHandoverPackageForHandover", write: "requiresHandoverPackageForHandover"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "listedOnPortal",
                            widget: "#Switch",
                            label: "form.listedOnPortalLabel",
                        },
                        permissions: {read: "listedOnPortal", write: "listedOnPortal"},
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
    nodes: propertyManagementConfigCreateFormNodes,
};

export const propertyManagementConfigEditFormView: ViewConfig = {
    model: "propertymanagementconfigs",
    viewType: "form",
    viewMode: "edit",
    accessModel: "propertymanagementconfigs",
    apiUrl: "/api/realEstate/propertyManagementConfig",
    method: "PATCH",
    nodes: propertyManagementConfigEditFormNodes,
};

export const propertyManagementConfigViews: ViewConfig[] = [
    propertyManagementConfigSheetView,
    propertyManagementConfigCreateFormView,
    propertyManagementConfigEditFormView,
];
