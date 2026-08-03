import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {liquidityGranularityValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/liquidityPlan/liquidityPlan.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const granularityOptions = liquidityGranularityValues.map((value) => ({value, label: value}));

export const liquidityPlanSheetView: ViewConfig = {
    model: "liquidityplans",
    viewType: "sheet",
    accessModel: "liquidityplans",
    apiUrl: "/api/realEstate/liquidityPlan",
    header: {titleField: "title", subtitleKey: "liquidityPlan", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#SmallInfoCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "title"}, field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "horizonStart"}, dependent: "horizonStart", field: {name: "horizonStart", widget: "#SmallInfoCard", label: "horizonStart", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "horizonEnd"}, dependent: "horizonEnd", field: {name: "horizonEnd", widget: "#SmallInfoCard", label: "horizonEnd", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "granularity"}, dependent: "granularity", field: {name: "granularity", widget: "#SmallInfoCard", label: "granularity", widgetProps: {icon: "#IconLabel", languageKeyCategory: "granularities"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "horizonStart", widget: "#DateInput", label: "form.horizonStartLabel", placeholder: "form.horizonStartPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "horizonEnd", widget: "#DateInput", label: "form.horizonEndLabel", placeholder: "form.horizonEndPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "granularity", widget: "#Select", label: "form.granularityLabel", placeholder: "form.granularityPlaceholder", widgetProps: {options: granularityOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const liquidityPlanCreateFormView: ViewConfig = {
    model: "liquidityplans", viewType: "form", viewMode: "create", accessModel: "liquidityplans",
    apiUrl: "/api/realEstate/liquidityPlan", method: "PUT", nodes: formNodes,
};

export const liquidityPlanEditFormView: ViewConfig = {
    model: "liquidityplans", viewType: "form", viewMode: "edit", accessModel: "liquidityplans",
    apiUrl: "/api/realEstate/liquidityPlan", method: "PATCH", nodes: formNodes,
};

export const liquidityPlanViews: ViewConfig[] = [liquidityPlanSheetView, liquidityPlanCreateFormView, liquidityPlanEditFormView];
