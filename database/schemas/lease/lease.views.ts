import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

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
                        {render: "#SmallInfoCard", permissions: {read: "status"},      field: {name: "status",      widget: "#SmallInfoCard", label: "status",      widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "startDate"},   field: {name: "startDate",   widget: "#SmallInfoCard", label: "startDate",   widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "endDate"},     field: {name: "endDate",     widget: "#SmallInfoCard", label: "endDate",     widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "monthlyRent"}, field: {name: "monthlyRent", widget: "#SmallInfoCard", label: "monthlyRent", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "depositPaid"}, field: {name: "depositPaid", widget: "#SmallInfoCard", label: "depositPaid", widgetProps: {icon: "#IconLabel"}}},
                    ],
                },
            ],
        },
    ],
};

const leaseFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props:  {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props:  {columns: 2},
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
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "endDate",
                            widget:      "#DateInput",
                            label:       "form.endDateLabel",
                            required:    true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
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
                ],
            },
            {
                render: "#Field",
                field: {
                    name:        "notes",
                    widget:      "#Textarea",
                    label:       "form.notesLabel",
                    widgetProps: {className: "resize-none max-h-[250px] overflow-y-auto"},
                },
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
