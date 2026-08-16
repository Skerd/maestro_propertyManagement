import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {specificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/specification/specification.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const standardOptions = specificationStandardValues.map((value) => ({value, label: value}));

export const specificationSheetView: ViewConfig = {
    model: "specifications",
    viewType: "sheet",
    accessModel: "specifications",
    apiUrl: "/api/realEstate/specification",
    header: {titleField: "title", subtitleKey: "specification", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "workPackage"}, dependent: "workPackage", field: {name: "workPackage.title", widget: "#DisplayCard", label: "workPackage", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "standard"}, dependent: "standard", field: {name: "standard", widget: "#DisplayCard", label: "standard", widgetProps: {icon: "#IconLabel", languageKeyCategory: "standards"}}},
                        {render: "#DisplayCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#DisplayCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "totalEstimated"}, dependent: "totalEstimated", field: {name: "totalEstimated", widget: "#DisplayCard", label: "totalEstimated", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "workPackage", widget: "#ApiSelect", label: "form.workPackageLabel", placeholder: "form.workPackagePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/workPackage/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "standard", widget: "#Select", label: "form.standardLabel", placeholder: "form.standardPlaceholder", widgetProps: {options: standardOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "totalEstimated", widget: "#Input", label: "form.totalEstimatedLabel", placeholder: "form.totalEstimatedPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const specificationCreateFormView: ViewConfig = {
    model: "specifications", viewType: "form", viewMode: "create", accessModel: "specifications",
    apiUrl: "/api/realEstate/specification", method: "PUT", nodes: formNodes,
};

export const specificationEditFormView: ViewConfig = {
    model: "specifications", viewType: "form", viewMode: "edit", accessModel: "specifications",
    apiUrl: "/api/realEstate/specification", method: "PATCH", nodes: formNodes,
};

export const specificationViews: ViewConfig[] = [specificationSheetView, specificationCreateFormView, specificationEditFormView];
