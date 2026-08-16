import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {approvalDocumentTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalWorkflow/approvalWorkflow.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const documentTypeOptions = approvalDocumentTypeValues.map((value) => ({value, label: value}));

export const approvalWorkflowSheetView: ViewConfig = {
    model: "approvalworkflows",
    viewType: "sheet",
    accessModel: "approvalworkflows",
    apiUrl: "/api/realEstate/approvalWorkflow",
    header: {titleField: "title", subtitleKey: "approvalWorkflow", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "documentType"}, field: {name: "documentType", widget: "#DisplayCard", label: "documentType", widgetProps: {icon: "#IconLabel", languageKeyCategory: "documentTypes"}}},
                        {render: "#DisplayCard", permissions: {read: "title"}, field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "approverRole"}, dependent: "approverRole", field: {name: "approverRole", widget: "#DisplayCard", label: "approverRole", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "thresholdAmount"}, dependent: "thresholdAmount", field: {name: "thresholdAmount", widget: "#DisplayCard", label: "thresholdAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "thresholdCurrency"}, dependent: "thresholdCurrency", field: {name: "thresholdCurrency.abbreviation", widget: "#DisplayCard", label: "thresholdCurrency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "escalationRole"}, dependent: "escalationRole", field: {name: "escalationRole", widget: "#DisplayCard", label: "escalationRole", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "active"}, field: {name: "active", widget: "#DisplayCard", label: "active", widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "active"}}},
                        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
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
                    {render: "#Field", field: {name: "documentType", widget: "#Select", label: "form.documentTypeLabel", placeholder: "form.documentTypePlaceholder", required: true, widgetProps: {options: documentTypeOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "approverRole", widget: "#Input", label: "form.approverRoleLabel", placeholder: "form.approverRolePlaceholder"}},
                    {render: "#Field", field: {name: "thresholdAmount", widget: "#Input", label: "form.thresholdAmountLabel", placeholder: "form.thresholdAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "thresholdCurrency", widget: "#ApiSelect", label: "form.thresholdCurrencyLabel", placeholder: "form.thresholdCurrencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "escalationRole", widget: "#Input", label: "form.escalationRoleLabel", placeholder: "form.escalationRolePlaceholder"}},
                    {render: "#Field", field: {name: "active", widget: "#Switch", label: "form.activeLabel"}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const approvalWorkflowCreateFormView: ViewConfig = {
    model: "approvalworkflows", viewType: "form", viewMode: "create", accessModel: "approvalworkflows",
    apiUrl: "/api/realEstate/approvalWorkflow", method: "PUT", nodes: formNodes,
};

export const approvalWorkflowEditFormView: ViewConfig = {
    model: "approvalworkflows", viewType: "form", viewMode: "edit", accessModel: "approvalworkflows",
    apiUrl: "/api/realEstate/approvalWorkflow", method: "PATCH", nodes: formNodes,
};

export const approvalWorkflowViews: ViewConfig[] = [approvalWorkflowSheetView, approvalWorkflowCreateFormView, approvalWorkflowEditFormView];
