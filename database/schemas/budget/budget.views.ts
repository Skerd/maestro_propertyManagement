import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {budgetMethodValues, budgetClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/budget/budget.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const methodOptions = budgetMethodValues.map((value) => ({value, label: value}));
const classificationStandardOptions = budgetClassificationStandardValues.map((value) => ({value, label: value}));

export const budgetSheetView: ViewConfig = {
    model: "budgets",
    viewType: "sheet",
    accessModel: "budgets",
    apiUrl: "/api/realEstate/budget",
    header: {titleField: "title", subtitleKey: "budget", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#DisplayCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "edifice"}, dependent: "edifice", field: {name: "edifice.name", widget: "#DisplayCard", label: "edifice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "version"}, dependent: "version", field: {name: "version", widget: "#DisplayCard", label: "version", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "method"}, dependent: "method", field: {name: "method", widget: "#DisplayCard", label: "method", widgetProps: {icon: "#IconLabel", languageKeyCategory: "methods"}}},
                        {render: "#DisplayCard", permissions: {read: "classificationStandard"}, dependent: "classificationStandard", field: {name: "classificationStandard", widget: "#DisplayCard", label: "classificationStandard", widgetProps: {icon: "#IconLabel", languageKeyCategory: "classificationStandards"}}},
                        {render: "#DisplayCard", permissions: {read: "revisionNo"}, dependent: "revisionNo", field: {name: "revisionNo", widget: "#DisplayCard", label: "revisionNo", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "supersedesBudget"}, dependent: "supersedesBudget", field: {name: "supersedesBudget.title", widget: "#DisplayCard", label: "supersedesBudget", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#DisplayCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "approvedTotal"}, dependent: "approvedTotal", field: {name: "approvedTotal", widget: "#DisplayCard", label: "approvedTotal", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "contingencyPercent"}, dependent: "contingencyPercent", field: {name: "contingencyPercent", widget: "#DisplayCard", label: "contingencyPercent", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#DisplayCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "version", widget: "#Input", label: "form.versionLabel", placeholder: "form.versionPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "method", widget: "#Select", label: "form.methodLabel", placeholder: "form.methodPlaceholder", widgetProps: {options: methodOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "classificationStandard", widget: "#Select", label: "form.classificationStandardLabel", placeholder: "form.classificationStandardPlaceholder", widgetProps: {options: classificationStandardOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "revisionNo", widget: "#Input", label: "form.revisionNoLabel", placeholder: "form.revisionNoPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "supersedesBudget", widget: "#ApiSelect", label: "form.supersedesBudgetLabel", placeholder: "form.supersedesBudgetPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/budget/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "approvedTotal", widget: "#Input", label: "form.approvedTotalLabel", placeholder: "form.approvedTotalPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "contingencyPercent", widget: "#Input", label: "form.contingencyPercentLabel", placeholder: "form.contingencyPercentPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const budgetCreateFormView: ViewConfig = {
    model: "budgets", viewType: "form", viewMode: "create", accessModel: "budgets",
    apiUrl: "/api/realEstate/budget", method: "PUT", nodes: formNodes,
};

export const budgetEditFormView: ViewConfig = {
    model: "budgets", viewType: "form", viewMode: "edit", accessModel: "budgets",
    apiUrl: "/api/realEstate/budget", method: "PATCH", nodes: formNodes,
};

export const budgetViews: ViewConfig[] = [budgetSheetView, budgetCreateFormView, budgetEditFormView];
