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

function notifyUsersField(name: "notifyOnSales" | "notifyOnReservations", withPermissions: boolean): ViewConfig["nodes"][number] {
    return {
        render: "#Field",
        field: {
            name,
            widget: "#ObjectIdChipsInput",
            label: `form.${name}Label`,
            widgetProps: {
                apiUrl: "/api/company/users/select",
                method: "POST",
                placeholderKey: "form.selectUser",
                removeTooltipKey: "form.removeUser",
                selectPageSizeCreate: 50,
                selectPageSizeEdit: 200,
                labelRefFormExtraKey: name,
            },
        },
        ...(withPermissions ? {permissions: {read: name, write: name}} : {}),
    };
}

function notificationsSection(withPermissions: boolean): ViewConfig["nodes"][number] {
    return {
        render: "#TitleWithCollapse",
        props: {title: "notifications"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    notifyUsersField("notifyOnSales", withPermissions),
                    notifyUsersField("notifyOnReservations", withPermissions),
                ],
            },
        ],
    };
}

const propertyManagementConfigCreateFormNode: ViewConfig["nodes"] = [
    notificationsSection(false),
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

const propertyManagementConfigEditFormNode: ViewConfig["nodes"] = [
    notificationsSection(true),
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
                        }, permissions: {read: "requiresSaleApproval", write: "requiresSaleApproval"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "requiresHandoverPackageForHandover",
                            widget: "#Switch",
                            label: "form.requiresHandoverPackageForHandoverLabel",
                        }, permissions: {read: "requiresHandoverPackageForHandover", write: "requiresHandoverPackageForHandover"},
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
    nodes: propertyManagementConfigCreateFormNode,
};

export const propertyManagementConfigEditFormView: ViewConfig = {
    model: "propertymanagementconfigs",
    viewType: "form",
    viewMode: "edit",
    accessModel: "propertymanagementconfigs",
    apiUrl: "/api/realEstate/propertyManagementConfig",
    method: "PATCH",
    nodes: propertyManagementConfigEditFormNode,
};

export const propertyManagementConfigViews: ViewConfig[] = [
    propertyManagementConfigSheetView,
    propertyManagementConfigCreateFormView,
    propertyManagementConfigEditFormView,
];
