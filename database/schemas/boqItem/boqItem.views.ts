import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {boqItemClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/boqItem/boqItem.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const classificationStandardOptions = boqItemClassificationStandardValues.map((value) => ({value, label: value}));

export const boqItemSheetView: ViewConfig = {
    model: "boqitems",
    viewType: "sheet",
    accessModel: "boqitems",
    apiUrl: "/api/realEstate/boqItem",
    header: {titleField: "title", subtitleKey: "boqItem", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "budget"}, dependent: "budget", field: {name: "budget.name", widget: "#DisplayCard", label: "budget", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#DisplayCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "edifice"}, dependent: "edifice", field: {name: "edifice.name", widget: "#DisplayCard", label: "edifice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#DisplayCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "classificationStandard"}, dependent: "classificationStandard", field: {name: "classificationStandard", widget: "#DisplayCard", label: "classificationStandard", widgetProps: {icon: "#IconLabel", languageKeyCategory: "classificationStandards"}}},
                        {render: "#DisplayCard", permissions: {read: "classificationCode"}, dependent: "classificationCode", field: {name: "classificationCode", widget: "#DisplayCard", label: "classificationCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "elementCode"}, dependent: "elementCode", field: {name: "elementCode", widget: "#DisplayCard", label: "elementCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "wbsCode"}, dependent: "wbsCode", field: {name: "wbsCode", widget: "#DisplayCard", label: "wbsCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "trade"}, dependent: "trade", field: {name: "trade", widget: "#DisplayCard", label: "trade", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "category"}, dependent: "category", field: {name: "category", widget: "#DisplayCard", label: "category", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#DisplayCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "unitOfMeasure"}, dependent: "unitOfMeasure", field: {name: "unitOfMeasure", widget: "#DisplayCard", label: "unitOfMeasure", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "plannedQty"}, dependent: "plannedQty", field: {name: "plannedQty", widget: "#DisplayCard", label: "plannedQty", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "plannedRate"}, dependent: "plannedRate", field: {name: "plannedRate", widget: "#DisplayCard", label: "plannedRate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "plannedAmount"}, dependent: "plannedAmount", field: {name: "plannedAmount", widget: "#DisplayCard", label: "plannedAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "actualQty"}, dependent: "actualQty", field: {name: "actualQty", widget: "#DisplayCard", label: "actualQty", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "actualAmount"}, dependent: "actualAmount", field: {name: "actualAmount", widget: "#DisplayCard", label: "actualAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#DisplayCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "budget", widget: "#ApiSelect", label: "form.budgetLabel", placeholder: "form.budgetPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/budget/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "classificationStandard", widget: "#Select", label: "form.classificationStandardLabel", placeholder: "form.classificationStandardPlaceholder", widgetProps: {options: classificationStandardOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "classificationCode", widget: "#Input", label: "form.classificationCodeLabel", placeholder: "form.classificationCodePlaceholder", }},
                    {render: "#Field", field: {name: "elementCode", widget: "#Input", label: "form.elementCodeLabel", placeholder: "form.elementCodePlaceholder", }},
                    {render: "#Field", field: {name: "wbsCode", widget: "#Input", label: "form.wbsCodeLabel", placeholder: "form.wbsCodePlaceholder", }},
                    {render: "#Field", field: {name: "trade", widget: "#Input", label: "form.tradeLabel", placeholder: "form.tradePlaceholder", }},
                    {render: "#Field", field: {name: "category", widget: "#Input", label: "form.categoryLabel", placeholder: "form.categoryPlaceholder", }},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "unitOfMeasure", widget: "#Input", label: "form.unitOfMeasureLabel", placeholder: "form.unitOfMeasurePlaceholder", }},
                    {render: "#Field", field: {name: "plannedQty", widget: "#Input", label: "form.plannedQtyLabel", placeholder: "form.plannedQtyPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "plannedRate", widget: "#Input", label: "form.plannedRateLabel", placeholder: "form.plannedRatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "plannedAmount", widget: "#Input", label: "form.plannedAmountLabel", placeholder: "form.plannedAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "actualQty", widget: "#Input", label: "form.actualQtyLabel", placeholder: "form.actualQtyPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "actualAmount", widget: "#Input", label: "form.actualAmountLabel", placeholder: "form.actualAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const boqItemCreateFormView: ViewConfig = {
    model: "boqitems", viewType: "form", viewMode: "create", accessModel: "boqitems",
    apiUrl: "/api/realEstate/boqItem", method: "PUT", nodes: formNodes,
};

export const boqItemEditFormView: ViewConfig = {
    model: "boqitems", viewType: "form", viewMode: "edit", accessModel: "boqitems",
    apiUrl: "/api/realEstate/boqItem", method: "PATCH", nodes: formNodes,
};

export const boqItemViews: ViewConfig[] = [boqItemSheetView, boqItemCreateFormView, boqItemEditFormView];
