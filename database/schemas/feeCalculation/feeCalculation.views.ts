import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const feeCalculationSheetView: ViewConfig = {
    model: "feecalculations",
    viewType: "sheet",
    accessModel: "feecalculations",
    apiUrl: "/api/realEstate/feeCalculation",
    header: {titleField: "name", subtitleKey: "feeCalculation", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "consultantAppointment"}, dependent: "consultantAppointment", field: {name: "consultantAppointment.title", widget: "#SmallInfoCard", label: "consultantAppointment", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "basisAmount"}, dependent: "basisAmount", field: {name: "basisAmount", widget: "#SmallInfoCard", label: "basisAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "feePercent"}, dependent: "feePercent", field: {name: "feePercent", widget: "#SmallInfoCard", label: "feePercent", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "adjustmentFactor"}, dependent: "adjustmentFactor", field: {name: "adjustmentFactor", widget: "#SmallInfoCard", label: "adjustmentFactor", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "totalFee"}, dependent: "totalFee", field: {name: "totalFee", widget: "#SmallInfoCard", label: "totalFee", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "consultantAppointment", widget: "#ApiSelect", label: "form.consultantAppointmentLabel", placeholder: "form.consultantAppointmentPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/consultantAppointment/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "basisAmount", widget: "#Input", label: "form.basisAmountLabel", placeholder: "form.basisAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "feePercent", widget: "#Input", label: "form.feePercentLabel", placeholder: "form.feePercentPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
                    {render: "#Field", field: {name: "adjustmentFactor", widget: "#Input", label: "form.adjustmentFactorLabel", placeholder: "form.adjustmentFactorPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const feeCalculationCreateFormView: ViewConfig = {
    model: "feecalculations", viewType: "form", viewMode: "create", accessModel: "feecalculations",
    apiUrl: "/api/realEstate/feeCalculation", method: "PUT", nodes: formNodes,
};

export const feeCalculationEditFormView: ViewConfig = {
    model: "feecalculations", viewType: "form", viewMode: "edit", accessModel: "feecalculations",
    apiUrl: "/api/realEstate/feeCalculation", method: "PATCH", nodes: formNodes,
};

export const feeCalculationViews: ViewConfig[] = [feeCalculationSheetView, feeCalculationCreateFormView, feeCalculationEditFormView];
