import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {approvalDocumentTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/approvalRequest/approvalRequest.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const documentTypeOptions = approvalDocumentTypeValues.map((value) => ({value, label: value}));

export const approvalRequestSheetView: ViewConfig = {
    model: "approvalrequests",
    viewType: "sheet",
    accessModel: "approvalrequests",
    apiUrl: "/api/realEstate/approvalRequest",
    header: {titleField: "name", subtitleKey: "approvalRequest", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "documentType"}, field: {name: "documentType", widget: "#SmallInfoCard", label: "documentType", widgetProps: {icon: "#IconLabel", languageKeyCategory: "documentTypes"}}},
                        {render: "#SmallInfoCard", permissions: {read: "workflow"}, dependent: "workflow", field: {name: "workflow.title", widget: "#SmallInfoCard", label: "workflow", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "targetType"}, field: {name: "targetType", widget: "#SmallInfoCard", label: "targetType", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "amount"}, dependent: "amount", field: {name: "amount", widget: "#SmallInfoCard", label: "amount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currentStage"}, field: {name: "currentStage", widget: "#SmallInfoCard", label: "currentStage", widgetProps: {icon: "#CircleDot", languageKeyCategory: "stages"}}},
                        {render: "#SmallInfoCard", permissions: {read: "primaryDecision"}, field: {name: "primaryDecision", widget: "#SmallInfoCard", label: "primaryDecision", widgetProps: {icon: "#CircleDot", languageKeyCategory: "decisions"}}},
                        {render: "#SmallInfoCard", permissions: {read: "escalationDecision"}, field: {name: "escalationDecision", widget: "#SmallInfoCard", label: "escalationDecision", widgetProps: {icon: "#CircleDot", languageKeyCategory: "decisions"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    {render: "#Field", field: {name: "workflow", widget: "#ApiSelect", label: "form.workflowLabel", placeholder: "form.workflowPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/approvalWorkflow/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "targetType", widget: "#Input", label: "form.targetTypeLabel", placeholder: "form.targetTypePlaceholder", required: true}},
                    {render: "#Field", field: {name: "targetId", widget: "#Input", label: "form.targetIdLabel", placeholder: "form.targetIdPlaceholder", required: true}},
                    {render: "#Field", field: {name: "amount", widget: "#Input", label: "form.amountLabel", placeholder: "form.amountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const approvalRequestCreateFormView: ViewConfig = {
    model: "approvalrequests", viewType: "form", viewMode: "create", accessModel: "approvalrequests",
    apiUrl: "/api/realEstate/approvalRequest", method: "PUT", nodes: formNodes,
};

export const approvalRequestEditFormView: ViewConfig = {
    model: "approvalrequests", viewType: "form", viewMode: "edit", accessModel: "approvalrequests",
    apiUrl: "/api/realEstate/approvalRequest", method: "PATCH", nodes: formNodes,
};

export const approvalRequestViews: ViewConfig[] = [approvalRequestSheetView, approvalRequestCreateFormView, approvalRequestEditFormView];
