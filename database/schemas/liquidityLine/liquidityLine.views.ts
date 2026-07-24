import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {liquidityDirectionValues, liquiditySourceValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityLine/liquidityLine.schema-def";

const directionOptions = liquidityDirectionValues.map((value) => ({value, label: value}));
const sourceOptions = liquiditySourceValues.map((value) => ({value, label: value}));

export const liquidityLineSheetView: ViewConfig = {
    model: "liquiditylines",
    viewType: "sheet",
    accessModel: "liquiditylines",
    apiUrl: "/api/realEstate/liquidityLine",
    header: {titleField: "name", subtitleKey: "liquidityLine", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "plan"}, dependent: "plan", field: {name: "plan.title", widget: "#SmallInfoCard", label: "plan", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "period"}, dependent: "period", field: {name: "period", widget: "#SmallInfoCard", label: "period", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "direction"}, field: {name: "direction", widget: "#SmallInfoCard", label: "direction", widgetProps: {icon: "#CircleDot", languageKeyCategory: "directions"}}},
                        {render: "#SmallInfoCard", permissions: {read: "source"}, dependent: "source", field: {name: "source", widget: "#SmallInfoCard", label: "source", widgetProps: {icon: "#IconLabel", languageKeyCategory: "sources"}}},
                        {render: "#SmallInfoCard", permissions: {read: "title"}, dependent: "title", field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "plannedAmount"}, dependent: "plannedAmount", field: {name: "plannedAmount", widget: "#SmallInfoCard", label: "plannedAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "actualAmount"}, dependent: "actualAmount", field: {name: "actualAmount", widget: "#SmallInfoCard", label: "actualAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "plan", widget: "#ApiSelect", label: "form.planLabel", placeholder: "form.planPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/liquidityPlan/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "period", widget: "#DateInput", label: "form.periodLabel", placeholder: "form.periodPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "direction", widget: "#Select", label: "form.directionLabel", placeholder: "form.directionPlaceholder", required: true, widgetProps: {options: directionOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "source", widget: "#Select", label: "form.sourceLabel", placeholder: "form.sourcePlaceholder", widgetProps: {options: sourceOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder"}},
                    {render: "#Field", field: {name: "plannedAmount", widget: "#Input", label: "form.plannedAmountLabel", placeholder: "form.plannedAmountPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
                    {render: "#Field", field: {name: "actualAmount", widget: "#Input", label: "form.actualAmountLabel", placeholder: "form.actualAmountPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const liquidityLineCreateFormView: ViewConfig = {
    model: "liquiditylines", viewType: "form", viewMode: "create", accessModel: "liquiditylines",
    apiUrl: "/api/realEstate/liquidityLine", method: "PUT", nodes: formNodes,
};

export const liquidityLineEditFormView: ViewConfig = {
    model: "liquiditylines", viewType: "form", viewMode: "edit", accessModel: "liquiditylines",
    apiUrl: "/api/realEstate/liquidityLine", method: "PATCH", nodes: formNodes,
};

export const liquidityLineViews: ViewConfig[] = [liquidityLineSheetView, liquidityLineCreateFormView, liquidityLineEditFormView];
