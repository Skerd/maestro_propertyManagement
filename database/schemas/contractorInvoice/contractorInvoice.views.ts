import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {contractorInvoiceSourceValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/contractorInvoice/contractorInvoice.schema-def";

const sourceOptions = contractorInvoiceSourceValues.map((value) => ({value, label: value}));

export const contractorInvoiceSheetView: ViewConfig = {
    model: "contractorinvoices",
    viewType: "sheet",
    accessModel: "contractorinvoices",
    apiUrl: "/api/realEstate/contractorInvoice",
    header: {titleField: "name", subtitleKey: "contractorInvoice", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "invoiceNumber"}, dependent: "invoiceNumber", field: {name: "invoiceNumber", widget: "#SmallInfoCard", label: "invoiceNumber", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#SmallInfoCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#SmallInfoCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "invoiceDate"}, dependent: "invoiceDate", field: {name: "invoiceDate", widget: "#SmallInfoCard", label: "invoiceDate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "dueDate"}, dependent: "dueDate", field: {name: "dueDate", widget: "#SmallInfoCard", label: "dueDate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "grossAmount"}, dependent: "grossAmount", field: {name: "grossAmount", widget: "#SmallInfoCard", label: "grossAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "netAmount"}, dependent: "netAmount", field: {name: "netAmount", widget: "#SmallInfoCard", label: "netAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "vatAmount"}, dependent: "vatAmount", field: {name: "vatAmount", widget: "#SmallInfoCard", label: "vatAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "retentionHeld"}, dependent: "retentionHeld", field: {name: "retentionHeld", widget: "#SmallInfoCard", label: "retentionHeld", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "bkpAccountCode"}, dependent: "bkpAccountCode", field: {name: "bkpAccountCode", widget: "#SmallInfoCard", label: "bkpAccountCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "qrBillReference"}, dependent: "qrBillReference", field: {name: "qrBillReference", widget: "#SmallInfoCard", label: "qrBillReference", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "source"}, dependent: "source", field: {name: "source", widget: "#SmallInfoCard", label: "source", widgetProps: {icon: "#IconLabel", languageKeyCategory: "sources"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructionContract", widget: "#ApiSelect", label: "form.constructionContractLabel", placeholder: "form.constructionContractPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructionContract/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "invoiceNumber", widget: "#Input", label: "form.invoiceNumberLabel", placeholder: "form.invoiceNumberPlaceholder"}},
                    {render: "#Field", field: {name: "invoiceDate", widget: "#DateInput", label: "form.invoiceDateLabel", placeholder: "form.invoiceDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "dueDate", widget: "#DateInput", label: "form.dueDateLabel", placeholder: "form.dueDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "grossAmount", widget: "#Input", label: "form.grossAmountLabel", placeholder: "form.grossAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "netAmount", widget: "#Input", label: "form.netAmountLabel", placeholder: "form.netAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "vatAmount", widget: "#Input", label: "form.vatAmountLabel", placeholder: "form.vatAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "retentionHeld", widget: "#Input", label: "form.retentionHeldLabel", placeholder: "form.retentionHeldPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "bkpAccountCode", widget: "#Input", label: "form.bkpAccountCodeLabel", placeholder: "form.bkpAccountCodePlaceholder"}},
                    {render: "#Field", field: {name: "qrBillReference", widget: "#Input", label: "form.qrBillReferenceLabel", placeholder: "form.qrBillReferencePlaceholder"}},
                    {render: "#Field", field: {name: "source", widget: "#Select", label: "form.sourceLabel", placeholder: "form.sourcePlaceholder", widgetProps: {options: sourceOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const contractorInvoiceCreateFormView: ViewConfig = {
    model: "contractorinvoices", viewType: "form", viewMode: "create", accessModel: "contractorinvoices",
    apiUrl: "/api/realEstate/contractorInvoice", method: "PUT", nodes: formNodes,
};

export const contractorInvoiceEditFormView: ViewConfig = {
    model: "contractorinvoices", viewType: "form", viewMode: "edit", accessModel: "contractorinvoices",
    apiUrl: "/api/realEstate/contractorInvoice", method: "PATCH", nodes: formNodes,
};

export const contractorInvoiceViews: ViewConfig[] = [contractorInvoiceSheetView, contractorInvoiceCreateFormView, contractorInvoiceEditFormView];
