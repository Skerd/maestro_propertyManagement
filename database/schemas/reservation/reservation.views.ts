import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {RESERVATION_SOURCE_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.constants";

const sourceOptions = RESERVATION_SOURCE_VALUES.map((value) => ({value, label: `form.sourceValues.${value}`}));

export const reservationSheetView: ViewConfig = {
    model: "reservations",
    viewType: "sheet",
    accessModel: "reservations",
    apiUrl: "/api/realEstate/unit/reservation",
    header: {
        titleField: "name",
        subtitleKey: "reservation",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "unit",
                            permissions: { read: "unit" },
                            field: {
                                name: "unit",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            dependent: "client",
                            permissions: { read: "client" },
                            field: {
                                name: "client",
                                widget: "#SmallInfoCard",
                                label: "client",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "client",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "reservedBy",
                            permissions: { read: "reservedBy" },
                            field: {
                                name: "reservedBy",
                                widget: "#SmallInfoCard",
                                label: "reservedBy",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "reservedBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "reservedByCompany",
                            permissions: { read: "reservedByCompany" },
                            field: {
                                name: "reservedByCompany.name",
                                widget: "#SmallInfoCard",
                                label: "reservedByCompany",
                                widgetProps: { icon: "#Building2" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "isActive",
                            permissions: { read: "isActive" },
                            field: {
                                name: "isActive",
                                widget: "#SmallInfoCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    variant: "success",
                                    languageKeyCategory: "activeState",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            // dependent: "paid",
                            permissions: { read: "paid" },
                            field: {
                                name: "paid",
                                widget: "#SmallInfoCard",
                                label: "paid",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    variant: "success",
                                    variantLookupField: "paid",
                                    variantLookupMap: {
                                        true: "success",
                                        false: "destructive",
                                    },
                                    languageKeyCategory: "paidState",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "status",
                            permissions: { read: "status" },
                            field: {
                                name: "status",
                                widget: "#SmallInfoCard",
                                label: "reservationStatus",
                                widgetProps: {
                                    icon: "#Tag",
                                    languageKeyCategory: "statusValues",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "source",
                            permissions: { read: "source" },
                            field: {
                                name: "source",
                                widget: "#SmallInfoCard",
                                label: "source",
                                widgetProps: {
                                    icon: "#Globe",
                                    languageKeyCategory: "sourceValues",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "referralCode",
                            permissions: { read: "referralCode" },
                            field: {
                                name: "referralCode",
                                widget: "#SmallInfoCard",
                                label: "referralCode",
                                widgetProps: { icon: "#Hash" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "dates" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "reservationDate" },
                            field: {
                                name: "reservationDate",
                                widget: "#SmallInfoCard",
                                label: "reservationDate",
                                widgetProps: { icon: "#Calendar", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "expirationDate",
                            permissions: { read: "expirationDate" },
                            field: {
                                name: "expirationDate",
                                widget: "#SmallInfoCard",
                                label: "expirationDate",
                                widgetProps: { icon: "#CalendarClock", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "cancelledAt",
                            permissions: { read: "cancelledAt" },
                            field: {
                                name: "cancelledAt",
                                widget: "#SmallInfoCard",
                                label: "cancelledAt",
                                widgetProps: { icon: "#XCircle", format: "dateTime" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "clientEmailTimeline" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "confirmationEmailSentAt",
                            permissions: { read: "confirmationEmailSentAt" },
                            field: {
                                name: "confirmationEmailSentAt",
                                widget: "#SmallInfoCard",
                                label: "confirmationEmailSentAt",
                                widgetProps: { icon: "#Mail", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "expirationReminderEmailAt3d",
                            permissions: { read: "expirationReminderEmailAt3d" },
                            field: {
                                name: "expirationReminderEmailAt3d",
                                widget: "#SmallInfoCard",
                                label: "expirationReminderEmailAt3d",
                                widgetProps: { icon: "#Mail", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "expirationReminderEmailAt1d",
                            permissions: { read: "expirationReminderEmailAt1d" },
                            field: {
                                name: "expirationReminderEmailAt1d",
                                widget: "#SmallInfoCard",
                                label: "expirationReminderEmailAt1d",
                                widgetProps: { icon: "#Mail", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "expirationReminderEmailAt0d",
                            permissions: { read: "expirationReminderEmailAt0d" },
                            field: {
                                name: "expirationReminderEmailAt0d",
                                widget: "#SmallInfoCard",
                                label: "expirationReminderEmailAt0d",
                                widgetProps: { icon: "#Mail", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "expiredAt",
                            permissions: { read: "expiredAt" },
                            field: {
                                name: "expiredAt",
                                widget: "#SmallInfoCard",
                                label: "reservationExpiredAt",
                                widgetProps: { icon: "#XCircle", format: "dateTime" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "deposit" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "depositAmount",
                            permissions: { readAny: ["depositAmount", "depositCurrency"] },
                            field: {
                                name: "depositAmount",
                                widget: "#SmallInfoCard",
                                label: "depositAmount",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["depositCurrency.symbol", "depositAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "depositCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "paymentMethod",
                            permissions: { read: "paymentMethod" },
                            field: {
                                name: "paymentMethod",
                                widget: "#SmallInfoCard",
                                label: "paymentMethod",
                                widgetProps: { icon: "#CreditCard" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "financialSummary" },
            children: [
                {
                    render: "div",
                    props: {
                        className:
                            "rounded-lg border border-border/80 bg-muted/10 p-2 shadow-sm lg:p-4 gap-2 space-x-2",
                    },
                    children: [
                        {
                            render: "#SheetGrid",
                            props: { columns: 3 },
                            children: [
                                {
                                    render: "#SmallInfoCard",
                                    dependent: "unit",
                                    permissions: { read: "unit" },
                                    field: {
                                        name: "unit.price",
                                        widget: "#SmallInfoCard",
                                        label: "unitTotalPrice",
                                        widgetProps: {
                                            icon: "#Wallet",
                                            variant: "success",
                                            parent: "unit",
                                            valuePath: ["price", "priceCurrency.name"],
                                            joinSeparator: " ",
                                            format: "locale",
                                        },
                                    },
                                },
                                {
                                    render: "#SmallInfoCard",
                                    permissions: { read: "depositAmount" },
                                    field: {
                                        name: "depositAmount",
                                        widget: "#SmallInfoCard",
                                        label: "amountPaidReservationDeposit",
                                        widgetProps: {
                                            icon: "#Landmark",
                                            variant: "success",
                                            valuePath: ["depositAmount", "depositCurrency.name"],
                                            joinSeparator: " ",
                                            format: "locale",
                                        },
                                    },
                                },
                                {
                                    render: "#SmallInfoCard",
                                    permissions: { readAny: ["unit", "depositAmount", "paid"] },
                                    field: {
                                        name: "remainingBalance",
                                        widget: "#SmallInfoCard",
                                        label: "remainingBalance",
                                        widgetProps: {
                                            icon: "#Calculator",
                                            variantLookupField: "reservationFinancialPaymentState",
                                            variantLookupMap: {
                                                fullyPaid: "warning",
                                                partiallyPaid: "warning",
                                                unpaid: "warning",
                                            },
                                            valuePath: ["remainingBalance", "unit.priceCurrency.name"],
                                            joinSeparator: " ",
                                            format: "locale",
                                        },
                                    },
                                },
                                // {
                                //     render: "#SmallInfoCard",
                                //     permissions: { readAny: ["paid", "depositAmount"] },
                                //     field: {
                                //         name: "reservationFinancialPaymentState",
                                //         widget: "#SmallInfoCard",
                                //         label: "reservationPaymentStatus",
                                //         widgetProps: {
                                //             icon: "#Receipt",
                                //             variant: "warning",
                                //             variantLookupField: "reservationFinancialPaymentState",
                                //             variantLookupMap: {
                                //                 fullyPaid: "success",
                                //                 partiallyPaid: "warning",
                                //                 unpaid: "warning",
                                //             },
                                //             languageKeyCategory: "reservationFinancialPaymentState",
                                //         },
                                //     },
                                // }
                            ],
                        },
                        {
                            render: "div",
                            props: {className: "grid grid-cols-1 mt-2"},
                            children: [
                                {
                                    render: "#SmallInfoCard",
                                    permissions: { read: "expirationDate" },
                                    field: {
                                        name: "expirationDate",
                                        widget: "#SmallInfoCard",
                                        label: "remainingBalanceDueDate",
                                        widgetProps: {
                                            icon: "#Calendar",
                                            variant: "default",
                                            format: "date",
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
            render: "#SheetGroup",
            dependent: "cancellationReason",
            props: { title: "alerts" },
            children: [
                {
                    render: "div",
                    props: {
                        className:
                            "p-4 rounded-lg space-y-2 bg-red-500/10 border border-red-500/20",
                    },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "cancellationReason" },
                            field: {
                                name: "cancellationReason",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm text-red-600 dark:text-red-400" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            dependent: "reservationNotes",
            props: { title: "notes" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "reservationNotes" },
                            field: {
                                name: "reservationNotes",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            dependent: "reservationContract",
            permissions: { read: "reservationContract" },
            props: { title: "reservationContract" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: { read: "reservationContract" },
                            field: {
                                name: "reservationContract",
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
        {
            render: "#SheetGroup",
            dependent: "additionalDocuments",
            permissions: { read: "additionalDocuments" },
            props: { title: "additionalDocuments" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: { read: "additionalDocuments" },
                            field: {
                                name: "additionalDocuments",
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
    ],
};

/**
 * Create form: first block is project → edifice → floor → unit (same ApiSelect cascade pattern as unit form).
 * When `formExtras.prefilledUnitId` is true, the whole block is skipped (unit comes from route).
 */
const reservationCreateFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "unitLocationTitle", skipRenderWhenFormExtraTruthy: "prefilledUnitId" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                cascadeClearFormFields: ["edifice", "floor", "unit"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormField: { field: "project", paramName: "project" },
                                remountKeyFormField: "project",
                                cascadeClearFormFields: ["floor", "unit"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "floor",
                            widget: "#ApiSelect",
                            label: "form.floorLabel",
                            placeholder: "form.floorPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/floor/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormField: { field: "edifice", paramName: "edifice" },
                                remountKeyFormField: "edifice",
                                cascadeClearFormFields: ["unit"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unit",
                            widget: "#ApiSelect",
                            label: "form.unitLabel",
                            placeholder: "form.unitPlaceholder",
                            required: true,
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormFields: [
                                    { field: "project", paramName: "project" },
                                    { field: "edifice", paramName: "edifice" },
                                    { field: "floor", paramName: "floor" },
                                ],
                                enableWhenFormFieldsNonEmpty: ["project", "edifice"],
                                remountKeyFormField: "project",
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "reservedBy",
                            widget: "#ApiSelect",
                            label: "form.reservedByLabel",
                            placeholder: "form.reservedByPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: { administration: true },
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "client",
                            widget: "#ApiSelect",
                            label: "form.clientLabel",
                            placeholder: "form.clientPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: { administration: false },
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expirationDate",
                            widget: "#DateInput",
                            label: "form.expirationDateLabel",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "depositAmount",
                            widget: "#Input",
                            label: "form.depositAmountLabel",
                            placeholder: "form.depositAmountPlaceholder",
                            widgetProps: { type: "decimal", step: "0.01" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "depositCurrency",
                            widget: "#ApiSelect",
                            label: "form.depositCurrencyLabel",
                            placeholder: "form.depositCurrencyPlaceholder",
                            widgetProps: { apiUrl: "/api/finance/currency/select", method: "GET" },
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "source",
                            widget: "#SimpleSelect",
                            label: "form.sourceLabel",
                            placeholder: "form.sourcePlaceholder",
                            widgetProps: { options: sourceOptions, className: "grow w-full" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "referralCode",
                            widget: "#Input",
                            label: "form.referralCodeLabel",
                            placeholder: "form.referralCodePlaceholder",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "paymentMethod",
                            widget: "#Input",
                            label: "form.paymentMethodLabel",
                            placeholder: "form.paymentMethodPlaceholder",
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: { columns: 1 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "reservationNotes",
                            widget: "#Textarea",
                            label: "form.reservationNotesLabel",
                            placeholder: "form.reservationNotesPlaceholder",
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "documentsSectionTitle" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "reservationContract",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 10,
                                showLabel: true,
                                labelKey: "form.reservationContractLabel",
                                addFileKey: "form.uploadReservationContract",
                                filesSelectedKey: "form.filesSelected",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "additionalDocuments",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 10,
                                showLabel: true,
                                labelKey: "form.additionalDocumentsLabel",
                                addFileKey: "form.uploadAdditionalDocuments",
                                filesSelectedKey: "form.filesSelected",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const reservationCreateFormView: ViewConfig = {
    model: "reservations",
    viewType: "form",
    viewMode: "create",
    accessModel: "reservations",
    apiUrl: "/api/realEstate/unit/reservation",
    method: "PUT",
    nodes: reservationCreateFormFields,
};

// Reservations are immutable after create — no edit form view.
export const reservationViews: ViewConfig[] = [reservationSheetView, reservationCreateFormView];
