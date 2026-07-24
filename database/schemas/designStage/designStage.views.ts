import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const designStageSheetView: ViewConfig = {
    model: "designstages",
    viewType: "sheet",
    accessModel: "designstages",
    apiUrl: "/api/realEstate/designStage",
    header: {titleField: "title", subtitleKey: "designStage", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "edifice"}, dependent: "edifice", field: {name: "edifice.name", widget: "#SmallInfoCard", label: "edifice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "stageType"}, dependent: "stageType", field: {name: "stageType", widget: "#SmallInfoCard", label: "stageType", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "sortOrder"}, dependent: "sortOrder", field: {name: "sortOrder", widget: "#SmallInfoCard", label: "sortOrder", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "stageType", widget: "#SimpleSelect", label: "form.stageTypeLabel", placeholder: "form.stageTypePlaceholder", required: true, widgetProps: {options: [{value: "concept", label: "form.stageType_concept"}, {value: "schematic", label: "form.stageType_schematic"}, {value: "design_development", label: "form.stageType_design_development"}, {value: "construction_documents", label: "form.stageType_construction_documents"}, {value: "tender", label: "form.stageType_tender"}, {value: "construction", label: "form.stageType_construction"}, {value: "as_built", label: "form.stageType_as_built"}]}}},
                    {render: "#Field", field: {name: "sortOrder", widget: "#Input", label: "form.sortOrderLabel", placeholder: "form.sortOrderPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const designStageCreateFormView: ViewConfig = {
    model: "designstages", viewType: "form", viewMode: "create", accessModel: "designstages",
    apiUrl: "/api/realEstate/designStage", method: "PUT", nodes: formNodes,
};

export const designStageEditFormView: ViewConfig = {
    model: "designstages", viewType: "form", viewMode: "edit", accessModel: "designstages",
    apiUrl: "/api/realEstate/designStage", method: "PATCH", nodes: formNodes,
};

export const designStageViews: ViewConfig[] = [designStageSheetView, designStageCreateFormView, designStageEditFormView];
