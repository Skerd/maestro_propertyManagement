import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {RENTAL_PAYMENT_LONG_TEXT_MAX} from "armonia/src/modules/propertyManagement/api/realEstate/private/rentalPayment/rentalPayment.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
                                    languageKeyCategory: "statuses",
                                    type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "lease",
                            permissions: {read: "lease"},
                            field: {
                                name: "lease",
                                widget: "#DisplayCard",
                                label: "lease",
                                widgetProps: {
                                    icon: "#FileText",
                                    linkedRefPath: "lease",
                                    linkedSheetModel: "leases",
                                    linkedSheetWidget: "#LeaseSheetView",
                                    linkedSheetEntityProp: "lease",
                                    parent: "lease",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
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
                            permissions: {read: "dueDate"},
                            field: {
                                name: "dueDate",
                                widget: "#DisplayCard",
                                label: "dueDate",
                                widgetProps: {icon: "#CalendarDays", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "amount"},
                            field: {
                                name: "amount",
                                widget: "#DisplayCard",
                                label: "amount",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "amount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "paidDate",
                            permissions: {read: "paidDate"},
                            field: {
                                name: "paidDate",
                                widget: "#DisplayCard",
                                label: "paidDate",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "paidAmount",
                            permissions: {read: "paidAmount"},
                            field: {
                                name: "paidAmount",
                                widget: "#DisplayCard",
                                label: "paidAmount",
                                widgetProps: {
                                    icon: "#Banknote",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "paidAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    type: "currency",
                                },
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
            dependent: "receiptMedia",
            permissions: {read: "receiptMedia"},
            props: {title: "receiptMedia"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: {read: "receiptMedia"},
                            field: {
                                name: "receiptMedia",
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
                                        maxLength: RENTAL_PAYMENT_LONG_TEXT_MAX,
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
