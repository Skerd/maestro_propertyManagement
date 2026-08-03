import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {planMarkupMarkerTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/planMarkup/planMarkup.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const markerTypeOptions = planMarkupMarkerTypeValues.map((value) => ({value, label: value}));

export const planMarkupSheetView: ViewConfig = {
    model: "planmarkups",
    viewType: "sheet",
    accessModel: "planmarkups",
    apiUrl: "/api/realEstate/planMarkup",
    header: {titleField: "title", subtitleKey: "planMarkup", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "title"}, field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "markerType"}, field: {name: "markerType", widget: "#SmallInfoCard", label: "markerType", widgetProps: {icon: "#IconLabel", languageKeyCategory: "markerTypes"}}},
                        {render: "#SmallInfoCard", permissions: {read: "page"}, dependent: "page", field: {name: "page", widget: "#SmallInfoCard", label: "page", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "layer"}, dependent: "layer", field: {name: "layer", widget: "#SmallInfoCard", label: "layer", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "geometryX"}, dependent: "geometryX", field: {name: "geometryX", widget: "#SmallInfoCard", label: "geometryX", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "geometryY"}, dependent: "geometryY", field: {name: "geometryY", widget: "#SmallInfoCard", label: "geometryY", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "createdOnSite"}, field: {name: "createdOnSite", widget: "#SmallInfoCard", label: "createdOnSite", widgetProps: {icon: "#CircleDot", languageKeyCategory: "onSiteState", variantLookupField: "createdOnSite"}}},
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
                    {render: "#Field", field: {name: "planDocument", widget: "#ApiSelect", label: "form.planDocumentLabel", placeholder: "form.planDocumentPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/projectDocument/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "markerType", widget: "#Select", label: "form.markerTypeLabel", placeholder: "form.markerTypePlaceholder", required: true, widgetProps: {options: markerTypeOptions, className: "grow w-full"}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "page", widget: "#Input", label: "form.pageLabel", placeholder: "form.pagePlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "layer", widget: "#Input", label: "form.layerLabel", placeholder: "form.layerPlaceholder"}},
                    {render: "#Field", field: {name: "geometryX", widget: "#Input", label: "form.geometryXLabel", placeholder: "form.geometryXPlaceholder", widgetProps: {type: "number", step: "0.001"}}},
                    {render: "#Field", field: {name: "geometryY", widget: "#Input", label: "form.geometryYLabel", placeholder: "form.geometryYPlaceholder", widgetProps: {type: "number", step: "0.001"}}},
                    {render: "#Field", field: {name: "geometryW", widget: "#Input", label: "form.geometryWLabel", placeholder: "form.geometryWPlaceholder", widgetProps: {type: "number", step: "0.001"}}},
                    {render: "#Field", field: {name: "geometryH", widget: "#Input", label: "form.geometryHLabel", placeholder: "form.geometryHPlaceholder", widgetProps: {type: "number", step: "0.001"}}},
                    {render: "#Field", field: {name: "createdOnSite", widget: "#Switch", label: "form.createdOnSiteLabel"}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const planMarkupCreateFormView: ViewConfig = {
    model: "planmarkups", viewType: "form", viewMode: "create", accessModel: "planmarkups",
    apiUrl: "/api/realEstate/planMarkup", method: "PUT", nodes: formNodes,
};

export const planMarkupEditFormView: ViewConfig = {
    model: "planmarkups", viewType: "form", viewMode: "edit", accessModel: "planmarkups",
    apiUrl: "/api/realEstate/planMarkup", method: "PATCH", nodes: formNodes,
};

export const planMarkupViews: ViewConfig[] = [planMarkupSheetView, planMarkupCreateFormView, planMarkupEditFormView];
