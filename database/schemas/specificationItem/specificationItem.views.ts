import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {specificationItemClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/specificationItem/specificationItem.schema-def";

const classificationStandardOptions = specificationItemClassificationStandardValues.map((value) => ({value, label: value}));

export const specificationItemSheetView: ViewConfig = {
    model: "specificationitems",
    viewType: "sheet",
    accessModel: "specificationitems",
    apiUrl: "/api/realEstate/specificationItem",
    header: {titleField: "title", subtitleKey: "specificationItem", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "specification"}, dependent: "specification", field: {name: "specification.title", widget: "#SmallInfoCard", label: "specification", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "title"}, field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "npkChapter"}, dependent: "npkChapter", field: {name: "npkChapter", widget: "#SmallInfoCard", label: "npkChapter", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "npkPosition"}, dependent: "npkPosition", field: {name: "npkPosition", widget: "#SmallInfoCard", label: "npkPosition", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "isRPosition"}, field: {name: "isRPosition", widget: "#SmallInfoCard", label: "isRPosition", widgetProps: {icon: "#CircleDot", languageKeyCategory: "rPositionState", variantLookupField: "isRPosition"}}},
                        {render: "#SmallInfoCard", permissions: {read: "classificationStandard"}, dependent: "classificationStandard", field: {name: "classificationStandard", widget: "#SmallInfoCard", label: "classificationStandard", widgetProps: {icon: "#IconLabel", languageKeyCategory: "classificationStandards"}}},
                        {render: "#SmallInfoCard", permissions: {read: "classificationCode"}, dependent: "classificationCode", field: {name: "classificationCode", widget: "#SmallInfoCard", label: "classificationCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "unitOfMeasure"}, dependent: "unitOfMeasure", field: {name: "unitOfMeasure", widget: "#SmallInfoCard", label: "unitOfMeasure", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "quantity"}, dependent: "quantity", field: {name: "quantity", widget: "#SmallInfoCard", label: "quantity", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "unitPrice"}, dependent: "unitPrice", field: {name: "unitPrice", widget: "#SmallInfoCard", label: "unitPrice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "lineTotal"}, dependent: "lineTotal", field: {name: "lineTotal", widget: "#SmallInfoCard", label: "lineTotal", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "specification", widget: "#ApiSelect", label: "form.specificationLabel", placeholder: "form.specificationPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/specification/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "npkChapter", widget: "#Input", label: "form.npkChapterLabel", placeholder: "form.npkChapterPlaceholder"}},
                    {render: "#Field", field: {name: "npkPosition", widget: "#Input", label: "form.npkPositionLabel", placeholder: "form.npkPositionPlaceholder"}},
                    {render: "#Field", field: {name: "isRPosition", widget: "#Switch", label: "form.isRPositionLabel"}},
                    {render: "#Field", field: {name: "classificationStandard", widget: "#Select", label: "form.classificationStandardLabel", placeholder: "form.classificationStandardPlaceholder", widgetProps: {options: classificationStandardOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "classificationCode", widget: "#Input", label: "form.classificationCodeLabel", placeholder: "form.classificationCodePlaceholder"}},
                    {render: "#Field", field: {name: "unitOfMeasure", widget: "#Input", label: "form.unitOfMeasureLabel", placeholder: "form.unitOfMeasurePlaceholder"}},
                    {render: "#Field", field: {name: "quantity", widget: "#Input", label: "form.quantityLabel", placeholder: "form.quantityPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "unitPrice", widget: "#Input", label: "form.unitPriceLabel", placeholder: "form.unitPricePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "sortIndex", widget: "#Input", label: "form.sortIndexLabel", placeholder: "form.sortIndexPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const specificationItemCreateFormView: ViewConfig = {
    model: "specificationitems", viewType: "form", viewMode: "create", accessModel: "specificationitems",
    apiUrl: "/api/realEstate/specificationItem", method: "PUT", nodes: formNodes,
};

export const specificationItemEditFormView: ViewConfig = {
    model: "specificationitems", viewType: "form", viewMode: "edit", accessModel: "specificationitems",
    apiUrl: "/api/realEstate/specificationItem", method: "PATCH", nodes: formNodes,
};

export const specificationItemViews: ViewConfig[] = [specificationItemSheetView, specificationItemCreateFormView, specificationItemEditFormView];
