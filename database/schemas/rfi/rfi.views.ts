import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const rfiSheetView: ViewConfig = {
    model: "rfis",
    viewType: "sheet",
    accessModel: "rfis",
    apiUrl: "/api/realEstate/rfi",
    header: {titleField: "title", subtitleKey: "rfi", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "question"}, dependent: "question", field: {name: "question", widget: "#DisplayCard", label: "question", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "answer"}, dependent: "answer", field: {name: "answer", widget: "#DisplayCard", label: "answer", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "dueDate"}, dependent: "dueDate", field: {name: "dueDate", widget: "#DisplayCard", label: "dueDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#DisplayCard", permissions: {read: "relatedDocument"}, dependent: "relatedDocument", field: {name: "relatedDocument.name", widget: "#DisplayCard", label: "relatedDocument", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "askedBy"}, dependent: "askedBy", field: {name: "askedBy", widget: "#DisplayCard", label: "askedBy", widgetProps: {icon: "#IconUserCheck", parent: "askedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
                        {render: "#DisplayCard", permissions: {read: "answeredBy"}, dependent: "answeredBy", field: {name: "answeredBy", widget: "#DisplayCard", label: "answeredBy", widgetProps: {icon: "#IconUserCheck", parent: "answeredBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
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
                    {render: "#Field", field: {name: "question", widget: "#Textarea", label: "form.questionLabel", placeholder: "form.questionPlaceholder", required: true, widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "answer", widget: "#Textarea", label: "form.answerLabel", placeholder: "form.answerPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "askedBy", widget: "#ApiSelect", label: "form.askedByLabel", placeholder: "form.askedByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "answeredBy", widget: "#ApiSelect", label: "form.answeredByLabel", placeholder: "form.answeredByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "dueDate", widget: "#DateInput", label: "form.dueDateLabel", placeholder: "form.dueDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "relatedDocument", widget: "#ApiSelect", label: "form.relatedDocumentLabel", placeholder: "form.relatedDocumentPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/projectDocument/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
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

export const rfiCreateFormView: ViewConfig = {
    model: "rfis", viewType: "form", viewMode: "create", accessModel: "rfis",
    apiUrl: "/api/realEstate/rfi", method: "PUT", nodes: formNodes,
};

export const rfiEditFormView: ViewConfig = {
    model: "rfis", viewType: "form", viewMode: "edit", accessModel: "rfis",
    apiUrl: "/api/realEstate/rfi", method: "PATCH", nodes: formNodes,
};

export const rfiViews: ViewConfig[] = [rfiSheetView, rfiCreateFormView, rfiEditFormView];
