import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const siteDiarySheetView: ViewConfig = {
    model: "sitediaries",
    viewType: "sheet",
    accessModel: "sitediaries",
    apiUrl: "/api/realEstate/siteDiary",
    header: {titleField: "title", subtitleKey: "siteDiary", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "diaryDate"}, dependent: "diaryDate", field: {name: "diaryDate", widget: "#DisplayCard", label: "diaryDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#DisplayCard", permissions: {read: "weather"}, dependent: "weather", field: {name: "weather", widget: "#DisplayCard", label: "weather", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "workforceCount"}, dependent: "workforceCount", field: {name: "workforceCount", widget: "#DisplayCard", label: "workforceCount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "plantSummary"}, dependent: "plantSummary", field: {name: "plantSummary", widget: "#DisplayCard", label: "plantSummary", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "workSummary"}, dependent: "workSummary", field: {name: "workSummary", widget: "#DisplayCard", label: "workSummary", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "visitors"}, dependent: "visitors", field: {name: "visitors", widget: "#DisplayCard", label: "visitors", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    props: {className: "max-w-full"},
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
                    {render: "#Field", field: {name: "diaryDate", widget: "#DateInput", label: "form.diaryDateLabel", placeholder: "form.diaryDatePlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "weather", widget: "#Input", label: "form.weatherLabel", placeholder: "form.weatherPlaceholder", }},
                    {render: "#Field", field: {name: "workforceCount", widget: "#Input", label: "form.workforceCountLabel", placeholder: "form.workforceCountPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "plantSummary", widget: "#Textarea", label: "form.plantSummaryLabel", placeholder: "form.plantSummaryPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "workSummary", widget: "#Textarea", label: "form.workSummaryLabel", placeholder: "form.workSummaryPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "visitors", widget: "#Textarea", label: "form.visitorsLabel", placeholder: "form.visitorsPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
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

export const siteDiaryCreateFormView: ViewConfig = {
    model: "sitediaries", viewType: "form", viewMode: "create", accessModel: "sitediaries",
    apiUrl: "/api/realEstate/siteDiary", method: "PUT", nodes: formNodes,
};

export const siteDiaryEditFormView: ViewConfig = {
    model: "sitediaries", viewType: "form", viewMode: "edit", accessModel: "sitediaries",
    apiUrl: "/api/realEstate/siteDiary", method: "PATCH", nodes: formNodes,
};

export const siteDiaryViews: ViewConfig[] = [siteDiarySheetView, siteDiaryCreateFormView, siteDiaryEditFormView];
