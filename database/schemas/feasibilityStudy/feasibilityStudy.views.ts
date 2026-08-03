import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const feasibilityStudySheetView: ViewConfig = {
    model: "feasibilitystudies",
    viewType: "sheet",
    accessModel: "feasibilitystudies",
    apiUrl: "/api/realEstate/feasibilityStudy",
    header: {titleField: "title", subtitleKey: "feasibilityStudy", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "landParcel"}, dependent: "landParcel", field: {name: "landParcel.name", widget: "#SmallInfoCard", label: "landParcel", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "assumptions"}, dependent: "assumptions", field: {name: "assumptions", widget: "#SmallInfoCard", label: "assumptions", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "softCostEstimate"}, dependent: "softCostEstimate", field: {name: "softCostEstimate", widget: "#SmallInfoCard", label: "softCostEstimate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "hardCostEstimate"}, dependent: "hardCostEstimate", field: {name: "hardCostEstimate", widget: "#SmallInfoCard", label: "hardCostEstimate", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "residualValue"}, dependent: "residualValue", field: {name: "residualValue", widget: "#SmallInfoCard", label: "residualValue", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "irrPercent"}, dependent: "irrPercent", field: {name: "irrPercent", widget: "#SmallInfoCard", label: "irrPercent", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "decision"}, dependent: "decision", field: {name: "decision", widget: "#SmallInfoCard", label: "decision", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "decisionNotes"}, dependent: "decisionNotes", field: {name: "decisionNotes", widget: "#SmallInfoCard", label: "decisionNotes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "decidedBy"}, dependent: "decidedBy", field: {name: "decidedBy", widget: "#SmallInfoCard", label: "decidedBy", widgetProps: {icon: "#IconUserCheck", parent: "decidedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
                        {render: "#SmallInfoCard", permissions: {read: "decidedAt"}, dependent: "decidedAt", field: {name: "decidedAt", widget: "#SmallInfoCard", label: "decidedAt", widgetProps: {icon: "#CalendarDays", format: "date"}}},
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
                    {render: "#Field", field: {name: "landParcel", widget: "#ApiSelect", label: "form.landParcelLabel", placeholder: "form.landParcelPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/landParcel/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "assumptions", widget: "#Textarea", label: "form.assumptionsLabel", placeholder: "form.assumptionsPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "softCostEstimate", widget: "#Input", label: "form.softCostEstimateLabel", placeholder: "form.softCostEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "hardCostEstimate", widget: "#Input", label: "form.hardCostEstimateLabel", placeholder: "form.hardCostEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "residualValue", widget: "#Input", label: "form.residualValueLabel", placeholder: "form.residualValuePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "irrPercent", widget: "#Input", label: "form.irrPercentLabel", placeholder: "form.irrPercentPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "decision", widget: "#Input", label: "form.decisionLabel", placeholder: "form.decisionPlaceholder", }},
                    {render: "#Field", field: {name: "decisionNotes", widget: "#Textarea", label: "form.decisionNotesLabel", placeholder: "form.decisionNotesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "decidedBy", widget: "#ApiSelect", label: "form.decidedByLabel", placeholder: "form.decidedByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "decidedAt", widget: "#DateInput", label: "form.decidedAtLabel", placeholder: "form.decidedAtPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
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

export const feasibilityStudyCreateFormView: ViewConfig = {
    model: "feasibilitystudies", viewType: "form", viewMode: "create", accessModel: "feasibilitystudies",
    apiUrl: "/api/realEstate/feasibilityStudy", method: "PUT", nodes: formNodes,
};

export const feasibilityStudyEditFormView: ViewConfig = {
    model: "feasibilitystudies", viewType: "form", viewMode: "edit", accessModel: "feasibilitystudies",
    apiUrl: "/api/realEstate/feasibilityStudy", method: "PATCH", nodes: formNodes,
};

export const feasibilityStudyViews: ViewConfig[] = [feasibilityStudySheetView, feasibilityStudyCreateFormView, feasibilityStudyEditFormView];
