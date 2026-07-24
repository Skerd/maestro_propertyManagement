import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {costClassificationStandardValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/costClassification/costClassification.schema-def";

const standardOptions = costClassificationStandardValues.map((value) => ({value, label: value}));

export const costClassificationSheetView: ViewConfig = {
    model: "costclassifications",
    viewType: "sheet",
    accessModel: "costclassifications",
    apiUrl: "/api/realEstate/costClassification",
    header: {titleField: "title", subtitleKey: "costClassification", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "standard"}, field: {name: "standard", widget: "#SmallInfoCard", label: "standard", widgetProps: {icon: "#IconLabel", languageKeyCategory: "standards"}}},
                        {render: "#SmallInfoCard", permissions: {read: "code"}, field: {name: "code", widget: "#SmallInfoCard", label: "code", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "parentCode"}, dependent: "parentCode", field: {name: "parentCode", widget: "#SmallInfoCard", label: "parentCode", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "level"}, dependent: "level", field: {name: "level", widget: "#SmallInfoCard", label: "level", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "title"}, field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "unitOfMeasure"}, dependent: "unitOfMeasure", field: {name: "unitOfMeasure", widget: "#SmallInfoCard", label: "unitOfMeasure", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "sortIndex"}, dependent: "sortIndex", field: {name: "sortIndex", widget: "#SmallInfoCard", label: "sortIndex", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "active"}, field: {name: "active", widget: "#SmallInfoCard", label: "active", widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "active"}}},
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
                    {render: "#Field", field: {name: "standard", widget: "#Select", label: "form.standardLabel", placeholder: "form.standardPlaceholder", required: true, widgetProps: {options: standardOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "code", widget: "#Input", label: "form.codeLabel", placeholder: "form.codePlaceholder", required: true}},
                    {render: "#Field", field: {name: "parentCode", widget: "#Input", label: "form.parentCodeLabel", placeholder: "form.parentCodePlaceholder"}},
                    {render: "#Field", field: {name: "level", widget: "#Input", label: "form.levelLabel", placeholder: "form.levelPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "unitOfMeasure", widget: "#Input", label: "form.unitOfMeasureLabel", placeholder: "form.unitOfMeasurePlaceholder"}},
                    {render: "#Field", field: {name: "sortIndex", widget: "#Input", label: "form.sortIndexLabel", placeholder: "form.sortIndexPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "active", widget: "#Switch", label: "form.activeLabel"}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const costClassificationCreateFormView: ViewConfig = {
    model: "costclassifications", viewType: "form", viewMode: "create", accessModel: "costclassifications",
    apiUrl: "/api/realEstate/costClassification", method: "PUT", nodes: formNodes,
};

export const costClassificationEditFormView: ViewConfig = {
    model: "costclassifications", viewType: "form", viewMode: "edit", accessModel: "costclassifications",
    apiUrl: "/api/realEstate/costClassification", method: "PATCH", nodes: formNodes,
};

export const costClassificationViews: ViewConfig[] = [costClassificationSheetView, costClassificationCreateFormView, costClassificationEditFormView];
