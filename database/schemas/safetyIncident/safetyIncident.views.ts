import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const safetyIncidentSheetView: ViewConfig = {
    model: "safetyincidents",
    viewType: "sheet",
    accessModel: "safetyincidents",
    apiUrl: "/api/realEstate/safetyIncident",
    header: {titleField: "title", subtitleKey: "safetyIncident", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "severity"}, dependent: "severity", field: {name: "severity", widget: "#SmallInfoCard", label: "severity", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "location"}, dependent: "location", field: {name: "location", widget: "#SmallInfoCard", label: "location", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "incidentDate"}, dependent: "incidentDate", field: {name: "incidentDate", widget: "#SmallInfoCard", label: "incidentDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "personsInvolved"}, dependent: "personsInvolved", field: {name: "personsInvolved", widget: "#SmallInfoCard", label: "personsInvolved", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "correctiveActions"}, dependent: "correctiveActions", field: {name: "correctiveActions", widget: "#SmallInfoCard", label: "correctiveActions", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "reportedBy"}, dependent: "reportedBy", field: {name: "reportedBy", widget: "#SmallInfoCard", label: "reportedBy", widgetProps: {icon: "#IconUserCheck", parent: "reportedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "media"},
            dependent: "media",
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "media"},
                            field: {name: "media", widget: "#GalleryCarousel", widgetProps: {imageGalleryField: "media", showThumbnails: false, allowFullScreen: false, coverAfterFirst: true, showPreviews: true, previewLocation: "right"}},
                        },
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
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "severity", widget: "#SimpleSelect", label: "form.severityLabel", placeholder: "form.severityPlaceholder", required: true, widgetProps: {options: [{value: "low", label: "form.severity_low"}, {value: "medium", label: "form.severity_medium"}, {value: "high", label: "form.severity_high"}, {value: "critical", label: "form.severity_critical"}]}}},
                    {render: "#Field", field: {name: "location", widget: "#Input", label: "form.locationLabel", placeholder: "form.locationPlaceholder", }},
                    {render: "#Field", field: {name: "incidentDate", widget: "#DateInput", label: "form.incidentDateLabel", placeholder: "form.incidentDatePlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "personsInvolved", widget: "#Textarea", label: "form.personsInvolvedLabel", placeholder: "form.personsInvolvedPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", required: true, widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "correctiveActions", widget: "#Textarea", label: "form.correctiveActionsLabel", placeholder: "form.correctiveActionsPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "reportedBy", widget: "#ApiSelect", label: "form.reportedByLabel", placeholder: "form.reportedByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
    {
        render: "div",
        props: {className: "col-span-full w-full", skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart"},
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.mediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "media",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 20,
                                accept: "application/pdf,image/*",
                                existingListExtraKey: "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey: "form.newFiles",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const safetyIncidentCreateFormView: ViewConfig = {
    model: "safetyincidents", viewType: "form", viewMode: "create", accessModel: "safetyincidents",
    apiUrl: "/api/realEstate/safetyIncident", method: "PUT", nodes: formNodes,
};

export const safetyIncidentEditFormView: ViewConfig = {
    model: "safetyincidents", viewType: "form", viewMode: "edit", accessModel: "safetyincidents",
    apiUrl: "/api/realEstate/safetyIncident", method: "PATCH", nodes: formNodes,
};

export const safetyIncidentViews: ViewConfig[] = [safetyIncidentSheetView, safetyIncidentCreateFormView, safetyIncidentEditFormView];
