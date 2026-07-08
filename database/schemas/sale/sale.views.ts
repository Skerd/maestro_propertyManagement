import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const saleSheetView: ViewConfig = {
    model: "sales",
    viewType: "sheet",
    accessModel: "sales",
    apiUrl: "/api/realEstate/unit/sale",
    header: {
        titleField: "name",
        subtitleKey: "sale",
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
                            permissions: { read: "paymentType" },
                            field: {
                                name: "paymentType",
                                widget: "#SmallInfoCard",
                                label: "paymentType",
                                widgetProps: {
                                    icon: "#CreditCard",
                                    languageKeyCategory: "paymentTypeEnum",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "project",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "project.name",
                                widget: "#SmallInfoCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "edifice",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "edifice.name",
                                widget: "#SmallInfoCard",
                                label: "edifice",
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "edifice",
                                    linkedSheetModel: "edifices",
                                    linkedSheetWidget: "#EdificeSheetView",
                                    linkedSheetEntityProp: "edifice",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "floor",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "floor.name",
                                widget: "#SmallInfoCard",
                                label: "floor",
                                widgetProps: {
                                    icon: "#Layers",
                                    linkedRefPath: "floor",
                                    linkedSheetModel: "floors",
                                    linkedSheetWidget: "#FloorSheetView",
                                    linkedSheetEntityProp: "floor",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "pricing" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "listedUnitPrice",
                            permissions: { read: "listedUnitPrice" },
                            field: {
                                name: "listedUnitPrice",
                                widget: "#SmallInfoCard",
                                label: "listedUnitPrice",
                                widgetProps: {
                                    icon: "#Tag",
                                    format: "locale",
                                    valuePath: ["listedUnitCurrency.symbol", "listedUnitPrice"],
                                    joinSeparator: " ",
                                    linkedRefPath: "listedUnitCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "saleCurrency",
                            permissions: { read: "saleCurrency" },
                            field: {
                                name: "saleCurrency.name",
                                widget: "#SmallInfoCard",
                                label: "saleCurrency",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    valuePath: ["saleCurrency.symbol", "saleCurrency.name"],
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
                            dependent: "localDiscount",
                            permissions: { read: "localDiscount" },
                            field: {
                                name: "localDiscount",
                                widget: "#SmallInfoCard",
                                label: "localDiscount",
                                widgetProps: { icon: "#Percent", suffix: "%" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "finalPrice" },
                            field: {
                                name: "finalPrice",
                                widget: "#SmallInfoCard",
                                label: "finalPrice",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    format: "locale",
                                    valuePath: ["saleCurrency.symbol", "finalPrice"],
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
                            dependent: "saleExchangeRate",
                            permissions: { read: "saleExchangeRate" },
                            field: {
                                name: "saleExchangeRate",
                                widget: "#SmallInfoCard",
                                label: "saleExchangeRate",
                                widgetProps: { icon: "#ArrowUpDown" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "reservationConvertedAmount",
                            permissions: { read: "reservationConvertedAmount" },
                            field: {
                                name: "reservationConvertedAmount",
                                widget: "#SmallInfoCard",
                                label: "reservationConvertedAmount",
                                widgetProps: {
                                    icon: "#Banknote",
                                    format: "locale",
                                    valuePath: ["listedUnitCurrency.symbol", "reservationConvertedAmount"],
                                    joinSeparator: " ",
                                    linkedRefPath: "listedUnitCurrency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "reservationExchangeRate",
                            permissions: { read: "reservationExchangeRate" },
                            field: {
                                name: "reservationExchangeRate",
                                widget: "#SmallInfoCard",
                                label: "reservationExchangeRate",
                                widgetProps: { icon: "#ArrowUpDown" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            props: { title: "parties" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "buyer",
                            permissions: { read: "buyer" },
                            field: {
                                name: "buyer.name",
                                widget: "#SmallInfoCard",
                                label: "buyer",
                                widgetProps: { icon: "#User" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "buyerCompany",
                            permissions: { read: "buyerCompany" },
                            field: {
                                name: "buyerCompany.name",
                                widget: "#SmallInfoCard",
                                label: "buyerCompany",
                                widgetProps: { icon: "#Building2" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "soldBy",
                            permissions: { read: "soldBy" },
                            field: {
                                name: "soldBy.name",
                                widget: "#SmallInfoCard",
                                label: "soldBy",
                                widgetProps: { icon: "#UserCheck" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "saleDate" },
                            field: {
                                name: "saleDate",
                                widget: "#SmallInfoCard",
                                label: "saleDate",
                                widgetProps: { icon: "#Calendar", format: "date" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "transactionReference",
                            permissions: { read: "transactionReference" },
                            field: {
                                name: "transactionReference",
                                widget: "#SmallInfoCard",
                                label: "transactionReference",
                                widgetProps: { icon: "#MessageSquare" },
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "sale.sheet.reservation.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    props: {
                        title: "reservation",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    /** Populated object or raw ObjectId string — avoid `reservation._id` (undefined when ref is a string). */
                    dependent: "reservation",
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "reservation" },
                                    field: {
                                        name: "reservation",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#ReservationCard",
                                            pageSize: 1,
                                            small: true,
                                            compactRow: {
                                                icon: "#BookMarked",
                                                label: "reservation",
                                                valuePath: ["name"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "reservations",
                                                linkedSheetWidget: "#ReservationSheetView",
                                                linkedSheetEntityProp: "reservation",
                                            },
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
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "sale.sheet.paymentPlan.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    props: {
                        title: "paymentPlan",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    dependent: "paymentPlan",
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "paymentPlan" },
                                    field: {
                                        name: "paymentPlan",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#PaymentPlanCard",
                                            pageSize: 1,
                                            small: true,
                                            compactRow: {
                                                icon: "#ListOrdered",
                                                label: "paymentPlan",
                                                valuePath: ["name"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "paymentPlans",
                                                linkedSheetWidget: "#PaymentPlanSheetView",
                                                linkedSheetEntityProp: "paymentPlan",
                                            },
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
            dependent: "purchaseContract",
            permissions: { read: "purchaseContract" },
            props: { title: "purchaseContract" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: { read: "purchaseContract" },
                            field: {
                                name: "purchaseContract",
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

/**
 * Create cash sale: project → edifice → floor → unit (skipped when `formExtras.prefilledUnitId`),
 * then sale party fields. Reservation
 * (`formExtras.cashSaleUnitSnapshot`). Read-only pricing breakdown is `renderChildren` in Sinfonia.
 * Documents use `#FormMultiLocalFileField` (multipart `File[]`).
 */
export const saleCreateCashFormFields: ViewConfig["nodes"] = [
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
        props: { title: "sectionTitle" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 4, className: "items-start gap-4" },
                children: [
                    {
                        render: "#Field",
                        permissions: { write: "soldBy" },
                        field: {
                            name: "soldBy",
                            widget: "#ApiSelect",
                            label: "form.soldByLabel",
                            placeholder: "form.soldByPlaceholder",
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
                        permissions: { write: "buyer" },
                        field: {
                            name: "buyer",
                            widget: "#ApiSelect",
                            label: "form.buyerLabel",
                            placeholder: "form.buyerPlaceholder",
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
                        permissions: { write: "saleDate" },
                        field: {
                            name: "saleDate",
                            widget: "#DateInput",
                            label: "form.saleDateLabel",
                            required: true,
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "saleCurrency" },
                        field: {
                            name: "saleCurrency",
                            widget: "#ApiSelect",
                            label: "form.saleCurrencyLabel",
                            placeholder: "form.saleCurrencyPlaceholder",
                            required: true,
                            widgetProps: { apiUrl: "/api/finance/currency/select", method: "GET" },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "localDiscount" },
                        field: {
                            name: "localDiscount",
                            widget: "#Input",
                            label: "form.localDiscountLabel",
                            placeholder: "form.localDiscountPlaceholder",
                            widgetProps: { type: "decimal", step: "0.01", min: 0, max: 100 },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "transactionReference" },
                        field: {
                            name: "transactionReference",
                            widget: "#Input",
                            label: "form.transactionReferenceLabel",
                            placeholder: "form.transactionReferencePlaceholder",
                        },
                    },
                    {
                        render: "#Field",
                        props: { skipRenderWhenFormExtraNotTruthy: "showReservationExchangeRate" },
                        field: {
                            name: "reservationExchangeRate",
                            widget: "#Input",
                            label: "form.reservationExchangeRateLabel",
                            placeholder: "form.reservationExchangeRatePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                type: "decimal",
                                step: "0.1",
                                min: 0,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        props: { skipRenderWhenFormExtraNotTruthy: "showSaleExchangeRate" },
                        field: {
                            name: "saleExchangeRate",
                            widget: "#Input",
                            label: "form.saleExchangeRateLabel",
                            placeholder: "form.saleExchangeRatePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                type: "decimal",
                                step: "0.1",
                                min: 0,
                            },
                        },
                    },
                    {
                        render: "#FormGrid",
                        props: { columns: 1, className: "md:col-span-3 items-start gap-4" },
                        children: [
                            {
                                render: "#Field",
                                permissions: { write: "notes" },
                                field: {
                                    name: "notes",
                                    widget: "#Textarea",
                                    label: "form.notesLabel",
                                    placeholder: "form.notesPlaceholder",
                                    widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                                },
                            },
                        ]
                    }
                ],
            },

        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "documentsSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "purchaseContract",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 1,
                                showLabel: true,
                                labelKey: "form.purchaseContractLabel",
                                addFileKey: "form.uploadPurchaseContract",
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

export const saleCreateCashFormView: ViewConfig = {
    model: "sales",
    viewType: "form",
    viewMode: "create",
    accessModel: "sales",
    apiUrl: "/api/realEstate/unit/sale",
    method: "PUT",
    nodes: saleCreateCashFormFields,
};

const saleEditFormFields: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: { columns: 1 },
        children: [
            {
                render: "#Field",
                permissions: { write: "transactionReference" },
                field: {
                    name: "transactionReference",
                    widget: "#Input",
                    label: "form.transactionReferenceLabel",
                    placeholder: "form.transactionReferencePlaceholder",
                },
            },
            {
                render: "#Field",
                permissions: { write: "notes" },
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                },
            },
        ],
    },
];

export const saleEditFormView: ViewConfig = {
    model: "sales",
    viewType: "form",
    viewMode: "edit",
    accessModel: "sales",
    apiUrl: "/api/realEstate/unit/sale",
    method: "PATCH",
    nodes: saleEditFormFields,
};

export const saleViews: ViewConfig[] = [
    saleSheetView,
    saleCreateCashFormView,
    saleEditFormView,
];
