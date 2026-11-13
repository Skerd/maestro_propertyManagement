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
            permissions: {
                readAny: [
                    "status",
                    "unit",
                    "tenant",
                    "startDate",
                    "endDate",
                    "monthlyRent",
                    "depositAmount",
                    "lateFeePercentage",
                    "gracePeriodDays",
                    "depositPaid",
                    "depositReturnedAt",
                    "notes",
                ],
            },
            props:  {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props:  {columns: 3},
                    children: [
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
                            dependent: "lateFeePercentage",
                            permissions: {read: "lateFeePercentage"},
                            field: {
                                name: "lateFeePercentage",
                                widget: "#DisplayCard",
                                label: "lateFeePercentage",
                                widgetProps: {icon: "#Percent", suffix: "%"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "gracePeriodDays",
                            permissions: {read: "gracePeriodDays"},
                            field: {
                                name: "gracePeriodDays",
                                widget: "#DisplayCard",
                                label: "gracePeriodDays",
                                widgetProps: {icon: "#Calendar", valueTemplateKey: "gracePeriodDaysValue"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            // Paid or not only means something when the lease asks for a deposit.
                            dependent: "depositAmount",
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
                            dependent: "notes",
                            permissions: {read: "notes"},
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
        // The rent months with their collect, waive and email actions, after the key facts and above Lifecycle (UX-03,
        // D151). The months check the rental payments' own access.
        {
            render: "#SheetGroup",
            props: {title: "schedule.title"},
            children: [{render: "#LeaseSchedule", field: {name: "_id", widget: "#LeaseSchedule"}}],
        },
        {
            render: "#SheetGroup",
            permissions: {readAny: ["terminationDate", "terminationReason"]},
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
                            dependent: "terminationDate",
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
            dependentAny: ["terminationDate", "terminationReason"],
        },
        {
            render: "#SheetGroup",
            dependent: "contractMedia",
            permissions: {readAny: ["contractMedia"]},
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

// Grouped in the order the lease is set up: where and who, how long, what it costs, then the contract and notes (UX-04).
const leaseCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props:  {title: "form.unitTenantSectionTitle"},
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
                                field: {name: "unit", widget: "#ApiSelect", label: "form.unitLabel", placeholder: "form.unitPlaceholder", required: true, widgetProps: {apiUrl: "/api/realEstate/unit/select", method: "POST", pageSize: 50}},
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
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props:  {title: "form.termSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props:  {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name:        "startDate",
                            widget:      "#DateInput",
                            label:       "form.startDateLabel",
                            placeholder: "form.startDatePlaceholder",
                            required:    true,
                            widgetProps: {
                                valueFormat: "YYYY-MM-DD",
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
                            placeholder: "form.endDatePlaceholder",
                            required:    true,
                            widgetProps: {
                                valueFormat: "YYYY-MM-DD",
                                minDateField: "startDate",
                                minDateExclusive: true,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props:  {title: "form.rentSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props:  {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name:        "monthlyRent",
                            widget:      "#Input",
                            label:       "form.monthlyRentLabel",
                            placeholder: "form.monthlyRentPlaceholder",
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
                            widgetProps: {apiUrl: "/api/finance/currency/select"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "depositAmount",
                            widget:      "#Input",
                            label:       "form.depositAmountLabel",
                            placeholder: "form.depositAmountPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "lateFeePercentage",
                            widget:      "#Input",
                            label:       "form.lateFeePercentageLabel",
                            placeholder: "form.lateFeePercentagePlaceholder",
                            widgetProps: {type: "number", min: 0, max: 100, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "gracePeriodDays",
                            widget:      "#Input",
                            label:       "form.gracePeriodDaysLabel",
                            placeholder: "form.gracePeriodDaysPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "1"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.contractMediaLabel"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "contractMedia",
                    widget: "#MediaField",
                    label: "form.contractMediaLabel",
                    required: true,
                    widgetProps: {mediaType: "file", mode: "single", maxCount: 1, accept: "application/pdf,image/*,.pdf"},
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.notesSectionTitle", defaultOpen: false},
        children: [
            {
                render: "#Field",
                field: {
                    name:        "notes",
                    widget:      "#Textarea",
                    label:       "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {
                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                        style: {maxHeight: 250},
                        maxLength: LEASE_LONG_TEXT_MAX,
                    },
                },
            },
        ],
    },
];

const leaseEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props:  {title: "form.unitTenantSectionTitle"},
        permissions: {readAny: ["unit", "tenant"], writeAny: ["unit", "tenant"]},
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
                                }, permissions: {read: "unit", write: "unit"},
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
                        }, permissions: {read: "tenant", write: "tenant"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props:  {title: "form.termSectionTitle"},
        permissions: {readAny: ["startDate", "endDate"], writeAny: ["startDate", "endDate"]},
        children: [
            {
                render: "#FormGrid",
                props:  {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name:        "startDate",
                            widget:      "#DateInput",
                            label:       "form.startDateLabel",
                            placeholder: "form.startDatePlaceholder",
                            required:    true,
                            widgetProps: {
                                valueFormat: "YYYY-MM-DD",
                                maxDateField: "endDate",
                                maxDateExclusive: true,
                            },
                        }, permissions: {read: "startDate", write: "startDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "endDate",
                            widget:      "#DateInput",
                            label:       "form.endDateLabel",
                            placeholder: "form.endDatePlaceholder",
                            required:    true,
                            widgetProps: {
                                valueFormat: "YYYY-MM-DD",
                                minDateField: "startDate",
                                minDateExclusive: true,
                            },
                        }, permissions: {read: "endDate", write: "endDate"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props:  {title: "form.rentSectionTitle"},
        permissions: {
            readAny: ["monthlyRent", "rentCurrency", "depositAmount", "lateFeePercentage", "gracePeriodDays"],
            writeAny: ["monthlyRent", "rentCurrency", "depositAmount", "lateFeePercentage", "gracePeriodDays"],
        },
        children: [
            {
                render: "#FormGrid",
                props:  {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name:        "monthlyRent",
                            widget:      "#Input",
                            label:       "form.monthlyRentLabel",
                            placeholder: "form.monthlyRentPlaceholder",
                            required:    true,
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        }, permissions: {read: "monthlyRent", write: "monthlyRent"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "rentCurrency",
                            widget:      "#ApiSelect",
                            label:       "form.rentCurrencyLabel",
                            required:    true,
                            widgetProps: {apiUrl: "/api/finance/currency/select"},
                        }, permissions: {read: "rentCurrency", write: "rentCurrency"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "depositAmount",
                            widget:      "#Input",
                            label:       "form.depositAmountLabel",
                            placeholder: "form.depositAmountPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        }, permissions: {read: "depositAmount", write: "depositAmount"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "lateFeePercentage",
                            widget:      "#Input",
                            label:       "form.lateFeePercentageLabel",
                            placeholder: "form.lateFeePercentagePlaceholder",
                            widgetProps: {type: "number", min: 0, max: 100, step: "0.01"},
                        }, permissions: {read: "lateFeePercentage", write: "lateFeePercentage"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name:        "gracePeriodDays",
                            widget:      "#Input",
                            label:       "form.gracePeriodDaysLabel",
                            placeholder: "form.gracePeriodDaysPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "1"},
                        }, permissions: {read: "gracePeriodDays", write: "gracePeriodDays"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.contractMediaLabel"},
        permissions: {readAny: ["contractMedia"], writeAny: ["contractMedia"]},
        children: [
            {
                render: "#Field",
                field: {
                    name: "contractMedia",
                    widget: "#MediaField",
                    label: "form.contractMediaLabel",
                    required: true,
                    widgetProps: {mediaType: "file", mode: "single", maxCount: 1, accept: "application/pdf,image/*,.pdf"},
                },
                permissions: {read: "contractMedia", write: "contractMedia"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.notesSectionTitle", defaultOpen: false},
        permissions: {readAny: ["notes"], writeAny: ["notes"]},
        children: [
            {
                render: "#Field",
                field: {
                    name:        "notes",
                    widget:      "#Textarea",
                    label:       "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {
                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                        style: {maxHeight: 250},
                        maxLength: LEASE_LONG_TEXT_MAX,
                    },
                }, permissions: {read: "notes", write: "notes"},
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
    nodes:       leaseCreateFormNodes,
};

export const leaseEditFormView: ViewConfig = {
    model:       "leases",
    viewType:    "form",
    viewMode:    "edit",
    accessModel: "leases",
    apiUrl:      "/api/realEstate/lease",
    method:      "PATCH",
    nodes:       leaseEditFormNodes,
};

export const leaseViews = [leaseSheetView, leaseCreateFormView, leaseEditFormView];
