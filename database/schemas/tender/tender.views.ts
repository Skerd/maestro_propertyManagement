import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const tenderSheetView: ViewConfig = {
    model: "tenders",
    viewType: "sheet",
    accessModel: "tenders",
    apiUrl: "/api/realEstate/tender",
    header: {titleField: "title", subtitleKey: "tender", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "specification"}, dependent: "specification", field: {name: "specification.title", widget: "#DisplayCard", label: "specification", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "trades"}, dependent: "trades", field: {name: "trades", widget: "#DisplayCard", label: "trades", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "submissionDeadline"}, dependent: "submissionDeadline", field: {name: "submissionDeadline", widget: "#DisplayCard", label: "submissionDeadline", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "openingDate"}, dependent: "openingDate", field: {name: "openingDate", widget: "#DisplayCard", label: "openingDate", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "specification", widget: "#ApiSelect", label: "form.specificationLabel", placeholder: "form.specificationPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/specification/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "trades", widget: "#StringArrayField", label: "form.tradesLabel", placeholder: "form.tradesPlaceholder", widgetProps: {removeTooltipKey: "removeTrade"}}},
                    {render: "#Field", field: {name: "submissionDeadline", widget: "#DateInput", label: "form.submissionDeadlineLabel", placeholder: "form.submissionDeadlinePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "openingDate", widget: "#DateInput", label: "form.openingDateLabel", placeholder: "form.openingDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const tenderCreateFormView: ViewConfig = {
    model: "tenders", viewType: "form", viewMode: "create", accessModel: "tenders",
    apiUrl: "/api/realEstate/tender", method: "PUT", nodes: formNodes,
};

export const tenderEditFormView: ViewConfig = {
    model: "tenders", viewType: "form", viewMode: "edit", accessModel: "tenders",
    apiUrl: "/api/realEstate/tender", method: "PATCH", nodes: formNodes,
};

export const tenderViews: ViewConfig[] = [tenderSheetView, tenderCreateFormView, tenderEditFormView];
