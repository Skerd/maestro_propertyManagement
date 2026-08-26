import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    LEASE_LONG_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/lease/lease.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const leaseSheetView: ViewConfig = {
    model:       "leases",
    viewType:    "sheet",
    accessModel: "leases",
    apiUrl:      "/api/realEstate/lease",
    header: {
        titleField:      "name",
        subtitleKey:     "lease",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props:  {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props:  {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "name",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: {icon: "#Tag"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#DisplayCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statusValues",
                                    type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "unit",
                            permissions: {read: "unit"},
                            field: {
                                name: "unit",
                                widget: "#DisplayCard",
                                label: "unit",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    linkedRefPath: "unit",
                                    linkedSheetModel: "units",
                                    linkedSheetWidget: "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                    parent: "unit",
                                    valuePath: ["name", "unitNumber", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "tenant",
                            permissions: {read: "tenant"},
                            field: {
                                name: "tenant",
                                widget: "#DisplayCard",
                                label: "tenant",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "tenant",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "startDate"},
                            field: {
                                name: "startDate",
                                widget: "#DisplayCard",
                                label: "startDate",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "endDate"},
                            field: {
                                name: "endDate",
                                widget: "#DisplayCard",
                                label: "endDate",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "monthlyRent"},
                            field: {
                                name: "monthlyRent",
                                widget: "#DisplayCard",
                                label: "monthlyRent",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["rentCurrency.symbol", "monthlyRent"],
                                    joinSeparator: " ",
                                    linkedRefPath: "rentCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "depositAmount",
                            permissions: {read: "depositAmount"},
                            field: {
                                name: "depositAmount",
                                widget: "#DisplayCard",
                                label: "depositAmount",
                                widgetProps: {
                                    icon: "#Banknote",
                                    format: "locale",
                                    valuePath: ["rentCurrency.symbol", "depositAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "rentCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "depositPaid"},
                            field: {
                                name: "depositPaid",
                                widget: "#DisplayCard",
                                label: "depositPaid",
                                widgetProps: {icon: "#CircleDot", type: "boolean"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "depositReturnedAt",
                            permissions: {read: "depositReturnedAt"},
                            field: {
                                name: "depositReturnedAt",
                                widget: "#DisplayCard",
                                label: "depositReturnedAt",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "notes"},
                            dependent: "notes",
                            field: {
                                name: "notes",
                                widget: "#DisplayCard",
                                label: "notes",
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
        {
            render: "#SheetGroup",
            dependent: "terminationDate",
            props: {title: "termination"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "terminationDate"},
                            field: {
                                name: "terminationDate",
                                widget: "#DisplayCard",
                                label: "terminationDate",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "terminationReason"},
                            dependent: "terminationReason",
                            field: {
                                name: "terminationReason",
                                widget: "#DisplayCard",
                                label: "terminationReason",
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
        {
            render: "#SheetGroup",
            dependent: "contractMedia",
            permissions: {read: "contractMedia"},
            props: {title: "contractMedia"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: {read: "contractMedia"},
                            field: {
                                name: "contractMedia",
                                widget: "#SheetMediaFilesStrip",
                                widgetProps: {
                                    canDownload: true,
                                    canRemove: false,
                                    isBig: false,
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

const leaseFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props:  {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props:  {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "div",
                        props:  {skipRenderWhenFormExtraTruthy: "prefilledUnitId"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name:        "unit",
                                    widget:      "#ApiSelect",
                                    label:       "form.unitLabel",
                                    placeholder: "form.unitPlaceholder",
                                    required:    true,
                                    skipWriteAccessGate: true,
                                    widgetProps: {
                                        apiUrl:   "/api/realEstate/unit/select",
                                        method:   "POST",
                                        pageSize: 50,
                                    },
                                },
                            },
                        ],
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "tenant",
                            widget:      "#ApiSelect",
                            label:       "form.tenantLabel",
                            placeholder: "form.tenantPlaceholder",
                            required:    true,
                            widgetProps: {
                                apiUrl:   "/api/company/users/select",
                                method:   "POST",
                                postBody: {administration: false},
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "startDate",
                            widget:      "#DateInput",
                            label:       "form.startDateLabel",
                            required:    true,
                            widgetProps: {
                                valueFormat: "yyyy-MM-dd",
                                maxDateField: "endDate",
                                maxDateExclusive: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "endDate",
                            widget:      "#DateInput",
                            label:       "form.endDateLabel",
                            required:    true,
                            widgetProps: {
                                valueFormat: "yyyy-MM-dd",
                                minDateField: "startDate",
                                minDateExclusive: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "monthlyRent",
                            widget:      "#Input",
                            label:       "form.monthlyRentLabel",
                            required:    true,
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "rentCurrency",
                            widget:      "#ApiSelect",
                            label:       "form.rentCurrencyLabel",
                            required:    true,
                            widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "depositAmount",
                            widget:      "#Input",
                            label:       "form.depositAmountLabel",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:   "depositPaid",
                            widget: "#Switch",
                            label:  "form.depositPaidLabel",
                        },
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name:        "notes",
                                    widget:      "#Textarea",
                                    label:       "form.notesLabel",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: LEASE_LONG_TEXT_MAX,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "div",
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props:  {title: "form.contractMediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name:              "contractMedia",
                            widget:            "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles:             1,
                                accept:               "application/pdf,image/*",
                                existingListExtraKey: "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey:     "form.newFiles",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const leaseCreateFormView: ViewConfig = {
    model:       "leases",
    viewType:    "form",
    viewMode:    "create",
    accessModel: "leases",
    apiUrl:      "/api/realEstate/lease",
    method:      "PUT",
    nodes:       leaseFormNodes,
};

export const leaseEditFormView: ViewConfig = {
    model:       "leases",
    viewType:    "form",
    viewMode:    "edit",
    accessModel: "leases",
    apiUrl:      "/api/realEstate/lease",
    method:      "PATCH",
    nodes:       leaseFormNodes,
};

export const leaseViews = [leaseSheetView, leaseCreateFormView, leaseEditFormView];
