import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

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
                ],
            },
        ],
    },
    // Publishing switches sit in their own last group (UX-04).
    {
        render: "#TitleWithCollapse",
        props: {title: "visibility"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
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
        permissions: {readAny: ["requiresSaleApproval", "requiresHandoverPackageForHandover"], writeAny: ["requiresSaleApproval", "requiresHandoverPackageForHandover"]},
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
                ],
            },
        ],
    },
    // Publishing switches sit in their own last group (UX-04).
    {
        render: "#TitleWithCollapse",
        props: {title: "visibility"},
        permissions: {readAny: ["listedOnPortal"], writeAny: ["listedOnPortal"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
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

// Forms only: the settings page edits the company's one config in place, and no page shows it as a sheet (TD-F81).
export const propertyManagementConfigViews: ViewConfig[] = [
    propertyManagementConfigCreateFormView,
    propertyManagementConfigEditFormView,
];
