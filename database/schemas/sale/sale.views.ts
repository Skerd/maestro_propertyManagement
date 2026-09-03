import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {SALE_LONG_TEXT_MAX, SALE_SHORT_TEXT_MAX} from "armonia/src/modules/propertyManagement/api/realEstate/private/unit/sale/sale.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
            permissions: {
                readAny: ["name", "unit", "paymentType", "notes"],
            },
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "code",
                                widgetProps: { icon: "#IconLabel" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "unit" },
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
                            permissions: { read: "paymentType" },
                            field: {
                                name: "paymentType",
                                widget: "#DisplayCard",
                                label: "paymentType",
                                widgetProps: {
                                    icon: "#CreditCard",
                                    languageKeyCategory: "paymentTypeEnum", type: "enum",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "project",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "project.name",
                                widget: "#DisplayCard",
                                label: "project",
                                skipReadAccessGate: true,
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "edifice",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "edifice.name",
                                widget: "#DisplayCard",
                                label: "edifice",
                                skipReadAccessGate: true,
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
                            render: "#DisplayCard",
                            dependent: "floor",
                            dependentRuntimeOnly: true,
                            field: {
                                name: "floor.name",
                                widget: "#DisplayCard",
                                label: "floor",
                                skipReadAccessGate: true,
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
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "notes" },
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
            permissions: {
                readAny: [
                    "listedUnitPrice",
                    "saleCurrency",
                    "localDiscount",
                    "finalPrice",
                    "saleExchangeRate",
                    "reservationConvertedAmount",
                    "reservationExchangeRate",
                ],
            },
            props: { title: "pricing" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "listedUnitPrice" },
                            field: {
                                name: "listedUnitPrice",
                                widget: "#DisplayCard",
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
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "saleCurrency" },
                            field: {
                                name: "saleCurrency.name",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: { read: "localDiscount" },
                            field: {
                                name: "localDiscount",
                                widget: "#DisplayCard",
                                label: "localDiscount",
                                widgetProps: { icon: "#Percent", suffix: "%" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "finalPrice" },
                            field: {
                                name: "finalPrice",
                                widget: "#DisplayCard",
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
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "saleExchangeRate" },
                            field: {
                                name: "saleExchangeRate",
                                widget: "#DisplayCard",
                                label: "saleExchangeRate",
                                widgetProps: { icon: "#ArrowUpDown" , type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "reservationConvertedAmount" },
                            field: {
                                name: "reservationConvertedAmount",
                                widget: "#DisplayCard",
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
                                    type: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "reservationExchangeRate" },
                            field: {
                                name: "reservationExchangeRate",
                                widget: "#DisplayCard",
                                label: "reservationExchangeRate",
                                widgetProps: { icon: "#ArrowUpDown" , type: "number"},
                            },
                        },
                    ],
                },
            ],
        },

        {
            render: "#SheetGroup",
            permissions: {
                readAny: ["buyer", "buyerCompany", "soldBy", "saleDate", "transactionReference"],
            },
            props: { title: "parties" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "buyer" },
                            field: {
                                name: "buyer",
                                widget: "#DisplayCard",
                                label: "buyer",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "buyer",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "buyerCompany" },
                            field: {
                                name: "buyerCompany.name",
                                widget: "#DisplayCard",
                                label: "buyerCompany",
                                widgetProps: { icon: "#Building2" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "soldBy" },
                            field: {
                                name: "soldBy",
                                widget: "#DisplayCard",
                                label: "soldBy",
                                widgetProps: {
                                    icon: "#UserCheck",
                                    parent: "soldBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "saleDate" },
                            field: {
                                name: "saleDate",
                                widget: "#DisplayCard",
                                label: "saleDate",
                                widgetProps: { icon: "#Calendar", format: "date" , type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "transactionReference" },
                            field: {
                                name: "transactionReference",
                                widget: "#DisplayCard",
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
                    permissions: { readAny: ["reservation"] },
                    props: {
                        title: "reservation",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    /** Populated object or raw ObjectId string — avoid `reservation._id` (undefined when ref is a string). */
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
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
                    permissions: { readAny: ["paymentPlan"] },
                    props: {
                        title: "paymentPlan",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
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
            permissions: { readAny: ["purchaseContract"] },
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
            permissions: { readAny: ["additionalDocuments"] },
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
            dependentAny: ["handedOverBy", "handoverNotes"],
            permissions: { readAny: ["handedOverBy", "handoverNotes"] },
            props: { title: "handover" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "handedOverBy" },
                            field: {
                                name: "handedOverBy",
                                widget: "#DisplayCard",
                                label: "handedOverBy",
                                widgetProps: {
                                    icon: "#UserCheck",
                                    parent: "handedOverBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "handoverNotes" },
                            field: {
                                name: "handoverNotes",
                                widget: "#DisplayCard",
                                label: "handoverNotes",
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
            dependentAny: ["titleTransferDate", "deedNumber", "notaryName"],
            permissions: { readAny: ["titleTransferDate", "deedNumber", "notaryName"] },
            props: { title: "titleTransfer" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "titleTransferDate" },
                            field: {
                                name: "titleTransferDate",
                                widget: "#DisplayCard",
                                label: "titleTransferDate",
                                widgetProps: { icon: "#Calendar", format: "date", type: "date" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "deedNumber" },
                            field: {
                                name: "deedNumber",
                                widget: "#DisplayCard",
                                label: "deedNumber",
                                widgetProps: { icon: "#IconFileText" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "notaryName" },
                            field: {
                                name: "notaryName",
                                widget: "#DisplayCard",
                                label: "notaryName",
                                widgetProps: { icon: "#IconWriting" },
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
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
                        field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, cascadeClearFormFields: ["edifice", "floor", "unit"]}},
                    },
                    {
                        render: "#Field",
                        field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, postBodyFromFormField: {field: "project", paramName: "project"}, remountKeyFormField: "project", cascadeClearFormFields: ["floor", "unit"]}},
                    },
                    {
                        render: "#Field",
                        field: {name: "floor", widget: "#ApiSelect", label: "form.floorLabel", placeholder: "form.floorPlaceholder", widgetProps: {apiUrl: "/api/realEstate/floor/select", method: "POST", pageSize: 50, postBodyFromFormField: {field: "edifice", paramName: "edifice"}, remountKeyFormField: "edifice", cascadeClearFormFields: ["unit"]}},
                    },
                    {
                        render: "#Field",
                        field: {name: "unit", widget: "#ApiSelect", label: "form.unitLabel", placeholder: "form.unitPlaceholder", required: true, widgetProps: {apiUrl: "/api/realEstate/unit/select", method: "POST", pageSize: 50, postBodyFromFormFields: [{field: "project", paramName: "project"}, {field: "edifice", paramName: "edifice"}, {field: "floor", paramName: "floor"}], enableWhenFormFieldsNonEmpty: ["project", "edifice"], remountKeyFormField: "project"}},
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
                        render: "#FormGrid",
                        props: { columns: 1, className: "sm:col-span-2 items-start gap-4" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "localDiscount",
                                    widget: "#LocalDiscountField",
                                    label: "form.localDiscountLabel",
                                    placeholder: "form.localDiscountPlaceholder",
                                    widgetProps: { type: "decimal", step: "0.01", min: 0, max: 100 },
                                },
                            },
                        ],
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "transactionReference",
                            widget: "#Input",
                            label: "form.transactionReferenceLabel",
                            placeholder: "form.transactionReferencePlaceholder",
                            widgetProps: { maxLength: SALE_SHORT_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        props: { skipRenderWhenFormExtraNotTruthy: "showReservationExchangeRate" },
                        field: {name: "reservationExchangeRate", widget: "#Input", label: "form.reservationExchangeRateLabel", placeholder: "form.reservationExchangeRatePlaceholder", widgetProps: {type: "decimal", step: "0.1", min: 0}},
                    },
                    {
                        render: "#Field",
                        props: { skipRenderWhenFormExtraNotTruthy: "showSaleExchangeRate" },
                        field: {name: "saleExchangeRate", widget: "#Input", label: "form.saleExchangeRateLabel", placeholder: "form.saleExchangeRatePlaceholder", widgetProps: {type: "decimal", step: "0.1", min: 0}},
                    },
                    {
                        render: "#FormGrid",
                        props: { columns: 1, className: "md:col-span-3 items-start gap-4" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "notes",
                                    widget: "#Textarea",
                                    label: "form.notesLabel",
                                    placeholder: "form.notesPlaceholder",
                                    widgetProps: {
                                        className: "resize-none max-h-[250px] overflow-y-auto",
                                        maxLength: SALE_LONG_TEXT_MAX,
                                    },
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
                        field: {name: "purchaseContract", widget: "#FormMultiLocalFileField", widgetProps: {maxFiles: 1, showLabel: true, labelKey: "form.purchaseContractLabel", addFileKey: "form.uploadPurchaseContract", filesSelectedKey: "form.filesSelected"}},
                    },
                    {
                        render: "#Field",
                        field: {name: "additionalDocuments", widget: "#FormMultiLocalFileField", widgetProps: {maxFiles: 10, showLabel: true, labelKey: "form.additionalDocumentsLabel", addFileKey: "form.uploadAdditionalDocuments", filesSelectedKey: "form.filesSelected"}},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "handoverSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "items-start gap-4"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "handoverDate",
                            widget: "#DateInput",
                            label: "form.handoverDateLabel",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "handedOverBy",
                            widget: "#ApiSelect",
                            label: "form.handedOverByLabel",
                            placeholder: "form.handedOverByPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: {administration: true},
                            },
                        },
                    },
                    {
                        render: "#FormGrid",
                        props: {columns: 1, className: "md:col-span-2 items-start gap-4"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "handoverNotes",
                                    widget: "#Textarea",
                                    label: "form.handoverNotesLabel",
                                    placeholder: "form.handoverNotesPlaceholder",
                                    widgetProps: {
                                        className: "resize-none max-h-[250px] overflow-y-auto",
                                        maxLength: SALE_LONG_TEXT_MAX,
                                    },
                                },
                            },
                        ],
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "handoverCertificate",
                            widget: "#FormMultiLocalFileField",
                            widgetProps: {
                                maxFiles: 1,
                                showLabel: true,
                                labelKey: "form.handoverCertificateLabel",
                                addFileKey: "form.uploadHandoverCertificate",
                                filesSelectedKey: "form.filesSelected",
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "titleTransferSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3, className: "items-start gap-4"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "titleTransferDate",
                            widget: "#DateInput",
                            label: "form.titleTransferDateLabel",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "deedNumber",
                            widget: "#Input",
                            label: "form.deedNumberLabel",
                            placeholder: "form.deedNumberPlaceholder",
                            widgetProps: {maxLength: SALE_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "notaryName",
                            widget: "#Input",
                            label: "form.notaryNameLabel",
                            placeholder: "form.notaryNamePlaceholder",
                            widgetProps: {maxLength: SALE_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "titleTransferCertificate",
                            widget: "#FormMultiLocalFileField",
                            widgetProps: {
                                maxFiles: 1,
                                showLabel: true,
                                labelKey: "form.titleTransferCertificateLabel",
                                addFileKey: "form.uploadTitleTransferCertificate",
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
        permissions: {
            readAny: ["transactionReference", "notes", "localDiscount"],
            writeAny: ["transactionReference", "notes", "localDiscount"],
        },
        children: [
            {
                render: "#Field",
                props: { skipRenderWhenFormExtraNotTruthy: "allowLocalDiscountEdit" },
                field: {
                    name: "localDiscount",
                    widget: "#LocalDiscountField",
                    label: "form.localDiscountLabel",
                    placeholder: "form.localDiscountPlaceholder",
                    widgetProps: { type: "decimal", step: "0.01", min: 0, max: 100 },
                },
                permissions: { read: "localDiscount", write: "localDiscount" },
            },
            {
                render: "#Field",
                field: {
                    name: "transactionReference",
                    widget: "#Input",
                    label: "form.transactionReferenceLabel",
                    placeholder: "form.transactionReferencePlaceholder",
                    widgetProps: { maxLength: SALE_SHORT_TEXT_MAX },
                }, permissions: {read: "transactionReference", write: "transactionReference"},
            },
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {
                        className: "resize-none max-h-[250px] overflow-y-auto",
                        maxLength: SALE_LONG_TEXT_MAX,
                    },
                }, permissions: {read: "notes", write: "notes"},
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
