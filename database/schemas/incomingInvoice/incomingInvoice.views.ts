import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const incomingInvoiceSheetView: ViewConfig = {
    model: "incominginvoices",
    viewType: "sheet",
    accessModel: "incominginvoices",
    apiUrl: "/api/realEstate/incomingInvoice",
    header: {titleField: "name", subtitleKey: "incomingInvoice", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#SmallInfoCard", permissions: {read: "name"}, field: {name: "name", widget: "#SmallInfoCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "title"}, dependent: "title", field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "ocrStatus"}, field: {name: "ocrStatus", widget: "#SmallInfoCard", label: "ocrStatus", widgetProps: {icon: "#CircleDot", languageKeyCategory: "ocrStatuses"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedSupplierName"}, dependent: "extractedSupplierName", field: {name: "extractedSupplierName", widget: "#SmallInfoCard", label: "extractedSupplierName", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedIban"}, dependent: "extractedIban", field: {name: "extractedIban", widget: "#SmallInfoCard", label: "extractedIban", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedAmount"}, dependent: "extractedAmount", field: {name: "extractedAmount", widget: "#SmallInfoCard", label: "extractedAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedCurrencyCode"}, dependent: "extractedCurrencyCode", field: {name: "extractedCurrencyCode", widget: "#SmallInfoCard", label: "extractedCurrencyCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedInvoiceNumber"}, dependent: "extractedInvoiceNumber", field: {name: "extractedInvoiceNumber", widget: "#SmallInfoCard", label: "extractedInvoiceNumber", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedInvoiceDate"}, dependent: "extractedInvoiceDate", field: {name: "extractedInvoiceDate", widget: "#SmallInfoCard", label: "extractedInvoiceDate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedDueDate"}, dependent: "extractedDueDate", field: {name: "extractedDueDate", widget: "#SmallInfoCard", label: "extractedDueDate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "extractedQrReference"}, dependent: "extractedQrReference", field: {name: "extractedQrReference", widget: "#SmallInfoCard", label: "extractedQrReference", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "matchedConstructor"}, dependent: "matchedConstructor", field: {name: "matchedConstructor.name", widget: "#SmallInfoCard", label: "matchedConstructor", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "bkpAccountCode"}, dependent: "bkpAccountCode", field: {name: "bkpAccountCode", widget: "#SmallInfoCard", label: "bkpAccountCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "createdContractorInvoice"}, dependent: "createdContractorInvoice", field: {name: "createdContractorInvoice.name", widget: "#SmallInfoCard", label: "createdContractorInvoice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
                    ],
                },
            ],
        },
    ],
};

const formNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder"}},
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "extractedSupplierName", widget: "#Input", label: "form.extractedSupplierNameLabel", placeholder: "form.extractedSupplierNamePlaceholder"}},
                    {render: "#Field", field: {name: "extractedIban", widget: "#Input", label: "form.extractedIbanLabel", placeholder: "form.extractedIbanPlaceholder"}},
                    {render: "#Field", field: {name: "extractedAmount", widget: "#Input", label: "form.extractedAmountLabel", placeholder: "form.extractedAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "extractedCurrencyCode", widget: "#Input", label: "form.extractedCurrencyCodeLabel", placeholder: "form.extractedCurrencyCodePlaceholder"}},
                    {render: "#Field", field: {name: "extractedInvoiceNumber", widget: "#Input", label: "form.extractedInvoiceNumberLabel", placeholder: "form.extractedInvoiceNumberPlaceholder"}},
                    {render: "#Field", field: {name: "extractedInvoiceDate", widget: "#DateInput", label: "form.extractedInvoiceDateLabel", placeholder: "form.extractedInvoiceDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "extractedDueDate", widget: "#DateInput", label: "form.extractedDueDateLabel", placeholder: "form.extractedDueDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "extractedQrReference", widget: "#Input", label: "form.extractedQrReferenceLabel", placeholder: "form.extractedQrReferencePlaceholder"}},
                    {render: "#Field", field: {name: "matchedConstructor", widget: "#ApiSelect", label: "form.matchedConstructorLabel", placeholder: "form.matchedConstructorPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "matchedContract", widget: "#ApiSelect", label: "form.matchedContractLabel", placeholder: "form.matchedContractPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructionContract/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "bkpAccountCode", widget: "#Input", label: "form.bkpAccountCodeLabel", placeholder: "form.bkpAccountCodePlaceholder"}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const incomingInvoiceCreateFormView: ViewConfig = {
    model: "incominginvoices", viewType: "form", viewMode: "create", accessModel: "incominginvoices",
    apiUrl: "/api/realEstate/incomingInvoice", method: "PUT", nodes: formNodes,
};

export const incomingInvoiceEditFormView: ViewConfig = {
    model: "incominginvoices", viewType: "form", viewMode: "edit", accessModel: "incominginvoices",
    apiUrl: "/api/realEstate/incomingInvoice", method: "PATCH", nodes: formNodes,
};

export const incomingInvoiceViews: ViewConfig[] = [incomingInvoiceSheetView, incomingInvoiceCreateFormView, incomingInvoiceEditFormView];
