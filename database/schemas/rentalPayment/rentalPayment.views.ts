import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const rentalPaymentSheetView: ViewConfig = {
    model:       "rentalpayments",
    viewType:    "sheet",
    accessModel: "rentalpayments",
    apiUrl:      "/api/realEstate/rentalPayment",
    header: {
        titleField:      "name",
        subtitleKey:     "rentalPayment",
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
                        {render: "#SmallInfoCard", permissions: {read: "status"},  field: {name: "status",  widget: "#SmallInfoCard", label: "status",  widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "dueDate"}, field: {name: "dueDate", widget: "#SmallInfoCard", label: "dueDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "amount"},  field: {name: "amount",  widget: "#SmallInfoCard", label: "amount",  widgetProps: {icon: "#IconLabel"}}},
                    ],
                },
            ],
        },
    ],
};

const rentalPaymentFormNodes: ViewConfig["nodes"] = [
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
                        props:  {skipRenderWhenFormExtraTruthy: "prefilledLeaseId"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name:        "lease",
                                    widget:      "#ApiSelect",
                                    label:       "form.leaseLabel",
                                    placeholder: "form.leasePlaceholder",
                                    required:    true,
                                    skipWriteAccessGate: true,
                                    widgetProps: {
                                        apiUrl:   "/api/realEstate/lease/select",
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
                            name:        "dueDate",
                            widget:      "#DateInput",
                            label:       "form.dueDateLabel",
                            required:    true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "amount",
                            widget:      "#Input",
                            label:       "form.amountLabel",
                            required:    true,
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "currency",
                            widget:      "#ApiSelect",
                            label:       "form.currencyLabel",
                            required:    true,
                            widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET"},
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
                props:  {title: "form.receiptMediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name:              "receiptMedia",
                            widget:            "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles:              1,
                                accept:                "application/pdf,image/*",
                                existingListExtraKey:  "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey:      "form.newFiles",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const rentalPaymentCreateFormView: ViewConfig = {
    model:       "rentalpayments",
    viewType:    "form",
    viewMode:    "create",
    accessModel: "rentalpayments",
    apiUrl:      "/api/realEstate/rentalPayment",
    method:      "PUT",
    nodes:       rentalPaymentFormNodes,
};

export const rentalPaymentEditFormView: ViewConfig = {
    model:       "rentalpayments",
    viewType:    "form",
    viewMode:    "edit",
    accessModel: "rentalpayments",
    apiUrl:      "/api/realEstate/rentalPayment",
    method:      "PATCH",
    nodes:       rentalPaymentFormNodes,
};

export const rentalPaymentViews = [
    rentalPaymentSheetView,
    rentalPaymentCreateFormView,
    rentalPaymentEditFormView,
];
