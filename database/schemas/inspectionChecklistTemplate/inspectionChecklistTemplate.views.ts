import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const inspectionChecklistTemplateSheetView: ViewConfig = {
    model: "inspectionchecklisttemplates",
    viewType: "sheet",
    accessModel: "inspectionchecklisttemplates",
    apiUrl: "/api/realEstate/inspectionChecklistTemplate",
    header: {titleField: "title", subtitleKey: "inspectionChecklistTemplate", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "trade"}, dependent: "trade", field: {name: "trade", widget: "#SmallInfoCard", label: "trade", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "stage"}, dependent: "stage", field: {name: "stage", widget: "#SmallInfoCard", label: "stage", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "itemsJson"}, dependent: "itemsJson", field: {name: "itemsJson", widget: "#SmallInfoCard", label: "itemsJson", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "trade", widget: "#Input", label: "form.tradeLabel", placeholder: "form.tradePlaceholder", }},
                    {render: "#Field", field: {name: "stage", widget: "#Input", label: "form.stageLabel", placeholder: "form.stagePlaceholder", }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "itemsJson", widget: "#Textarea", label: "form.itemsJsonLabel", placeholder: "form.itemsJsonPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const inspectionChecklistTemplateCreateFormView: ViewConfig = {
    model: "inspectionchecklisttemplates", viewType: "form", viewMode: "create", accessModel: "inspectionchecklisttemplates",
    apiUrl: "/api/realEstate/inspectionChecklistTemplate", method: "PUT", nodes: formNodes,
};

export const inspectionChecklistTemplateEditFormView: ViewConfig = {
    model: "inspectionchecklisttemplates", viewType: "form", viewMode: "edit", accessModel: "inspectionchecklisttemplates",
    apiUrl: "/api/realEstate/inspectionChecklistTemplate", method: "PATCH", nodes: formNodes,
};

export const inspectionChecklistTemplateViews: ViewConfig[] = [inspectionChecklistTemplateSheetView, inspectionChecklistTemplateCreateFormView, inspectionChecklistTemplateEditFormView];
