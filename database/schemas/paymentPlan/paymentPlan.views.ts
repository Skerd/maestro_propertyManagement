import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {saleCreateCashFormFields} from "../sale/sale.views";

export const paymentPlanSheetView: ViewConfig = {
    model: "paymentplans",
    viewType: "sheet",
    accessModel: "paymentPlans",
    apiUrl: "/api/realEstate/unit/paymentPlan",
    header: {
        titleField: "name",
        subtitleKey: "paymentPlan",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "name",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#SmallInfoCard",
                                label: "code",
                                widgetProps: { icon: "#IconLabel" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "status" },
                            field: {
                                name: "status",
                                widget: "#SmallInfoCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "paymentPlanStatusState",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        active: "warning",
                                        completed: "success",
                                        defaulted: "destructive",
                                        cancelled: "destructive",
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "financials" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "totalAmount" },
                            field: {
                                name: "totalAmount",
                                widget: "#SmallInfoCard",
                                label: "totalAmount",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "totalAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "downPayment" },
                            field: {
                                name: "downPayment",
                                widget: "#SmallInfoCard",
                                label: "downPayment",
                                widgetProps: {
                                    icon: "#Banknote",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "downPayment"],
                                    joinSeparator: " ",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "downPaymentPaid" },
                            field: {
                                name: "downPaymentPaid",
                                widget: "#SmallInfoCard",
                                label: "downPaymentPaid",
                                widgetProps: {
                                    icon: "#CheckCircle",
                                    languageKeyCategory: "downPaymentPaidState",
                                    variantLookupField: "downPaymentPaid",
                                    variantLookupMap: {
                                        true: "success",
                                        false: "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "remainingBalance" },
                            field: {
                                name: "remainingBalance",
                                widget: "#SmallInfoCard",
                                label: "remainingBalance",
                                widgetProps: {
                                    icon: "#Wallet",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "remainingBalance"],
                                    joinSeparator: " ",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "installmentAmount" },
                            field: {
                                name: "installmentAmount",
                                widget: "#SmallInfoCard",
                                label: "installmentAmount",
                                widgetProps: {
                                    icon: "#Receipt",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "installmentAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "saleCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "interestRate",
                            permissions: { read: "interestRate" },
                            field: {
                                name: "interestRate",
                                widget: "#SmallInfoCard",
                                label: "interestRate",
                                widgetProps: { icon: "#Percent", suffix: "%" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "lateFeePercentage",
                            permissions: { read: "lateFeePercentage" },
                            field: {
                                name: "lateFeePercentage",
                                widget: "#SmallInfoCard",
                                label: "lateFeePercentage",
                                widgetProps: { icon: "#AlarmClock", suffix: "%" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "schedule" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "startDate" },
                            field: {
                                name: "startDate",
                                widget: "#SmallInfoCard",
                                label: "startDate",
                                widgetProps: { icon: "#Calendar", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "endDate" },
                            field: {
                                name: "endDate",
                                widget: "#SmallInfoCard",
                                label: "endDate",
                                widgetProps: { icon: "#CalendarCheck", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "downPaymentDate",
                            permissions: { read: "downPaymentDate" },
                            field: {
                                name: "downPaymentDate",
                                widget: "#SmallInfoCard",
                                label: "downPaymentDate",
                                widgetProps: { icon: "#CalendarClock", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "gracePeriodDays",
                            permissions: { read: "gracePeriodDays" },
                            field: {
                                name: "gracePeriodDays",
                                widget: "#SmallInfoCard",
                                label: "gracePeriodDays",
                                widgetProps: { icon: "#Clock", suffix: " days" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "installments" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "numberOfInstallments" },
                            field: {
                                name: "numberOfInstallments",
                                widget: "#SmallInfoCard",
                                label: "installments",
                                widgetProps: { icon: "#ListOrdered" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            dependent: "notes",
            props: { title: "notes" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "notes" },
                            field: {
                                name: "notes",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },
    ],
};

const paymentPlanFormFields: ViewConfig["nodes"] = [
    saleCreateCashFormFields[0],
    saleCreateCashFormFields[1],
    {
        render: "#TitleWithCollapse",
        props: { title: "paymentPlanSectionTitle" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4, className: "items-start gap-4" },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "downPayment",
                            widget: "#Input",
                            label: "form.downPaymentLabel",
                            placeholder: "form.downPaymentPlaceholder",
                            required: true,
                            widgetProps: { type: "decimal", min: 0, step: "0.01" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "interestRate",
                            widget: "#Input",
                            label: "form.interestRateLabel",
                            placeholder: "form.interestRatePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: "0.01" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "gracePeriodDays",
                            widget: "#Input",
                            label: "form.gracePeriodDaysLabel",
                            placeholder: "form.gracePeriodDaysPlaceholder",
                            widgetProps: { type: "number", min: 0, step: "1" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "lateFeePercentage",
                            widget: "#Input",
                            label: "form.lateFeePercentageLabel",
                            placeholder: "form.lateFeePercentagePlaceholder",
                            widgetProps: { type: "decimal", min: 0, max: 100, step: "0.01" },
                        },
                    },
                    {
                        render: "#FormGrid",
                        props: { columns: 3 },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "downPaymentPaid",
                                    widget: "#Switch",
                                    label: "form.downPaymentPaidLabel",
                                    placeholder: "form.downPaymentPaidPlaceholder",
                                },
                            },
                            {
                                render: "div",
                                props: {className: "md:col-span-2",},
                                children: [
                                    {
                                        render: "#FormWhenFieldValueIn",
                                        props: { watchField: "downPaymentPaid", whenValues: ["true"] },
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "downPaymentDate",
                                                    widget: "#DateInput",
                                                    label: "form.downPaymentDateLabel",
                                                    placeholder: "form.downPaymentDatePlaceholder",
                                                    required: true,
                                                    widgetProps: { valueFormat: "yyyy-MM-dd" },
                                                },
                                            },
                                        ],
                                    },
                                ]
                            }
                        ],
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "numberOfInstallments",
                            widget: "#Input",
                            label: "form.numberOfInstallmentsLabel",
                            placeholder: "form.numberOfInstallmentsPlaceholder",
                            required: true,
                            widgetProps: { type: "number", min: 1 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "startDate",
                            widget: "#DateInput",
                            label: "form.startDateLabel",
                            placeholder: "form.startDatePlaceholder",
                            required: true,
                            widgetProps: { valueFormat: "yyyy-MM-dd", disabled: true },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "endDate",
                            widget: "#DateInput",
                            label: "form.endDateLabel",
                            placeholder: "form.endDatePlaceholder",
                            required: true,
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#FormGrid",
                        props: { columns: 1, className: "md:col-span-4 items-start gap-4" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "installments",
                                    widget: "#PaymentPlanInstallmentsField",
                                    label: "form.installmentsLabel",
                                    skipWriteAccessGate: true,
                                    widgetProps: {},
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    saleCreateCashFormFields[2]
];

/** Standalone PaymentPlan CRUD (`/api/realEstate/unit/paymentPlan`). Sale-attached plans use `sales` + `saleCreatePaymentPlanFormView` in `sale.views.ts`. */
export const paymentPlanCreateFormView: ViewConfig = {
    model: "paymentplans",
    viewType: "form",
    viewMode: "create",
    accessModel: "paymentPlans",
    apiUrl: "/api/realEstate/unit/paymentPlan",
    method: "PUT",
    nodes: paymentPlanFormFields,
};

export const paymentPlanEditFormView: ViewConfig = {
    model: "paymentplans",
    viewType: "form",
    viewMode: "edit",
    accessModel: "paymentPlans",
    apiUrl: "/api/realEstate/unit/paymentPlan",
    method: "PATCH",
    nodes: paymentPlanFormFields,
};

export const paymentPlanViews: ViewConfig[] = [paymentPlanSheetView, paymentPlanCreateFormView, paymentPlanEditFormView];
