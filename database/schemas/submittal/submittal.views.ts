import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const submittalSheetView: ViewConfig = {
    model: "submittals",
    viewType: "sheet",
    accessModel: "submittals",
    apiUrl: "/api/realEstate/submittal",
    header: {titleField: "title", subtitleKey: "submittal", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "specReference"}, dependent: "specReference", field: {name: "specReference", widget: "#SmallInfoCard", label: "specReference", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "relatedDocument"}, dependent: "relatedDocument", field: {name: "relatedDocument.name", widget: "#SmallInfoCard", label: "relatedDocument", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "submittedBy"}, dependent: "submittedBy", field: {name: "submittedBy", widget: "#SmallInfoCard", label: "submittedBy", widgetProps: {icon: "#IconUserCheck", parent: "submittedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
                        {render: "#SmallInfoCard", permissions: {read: "reviewedBy"}, dependent: "reviewedBy", field: {name: "reviewedBy", widget: "#SmallInfoCard", label: "reviewedBy", widgetProps: {icon: "#IconUserCheck", parent: "reviewedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
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
                    {render: "#Field", field: {name: "specReference", widget: "#Input", label: "form.specReferenceLabel", placeholder: "form.specReferencePlaceholder", }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "relatedDocument", widget: "#ApiSelect", label: "form.relatedDocumentLabel", placeholder: "form.relatedDocumentPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/projectDocument/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "submittedBy", widget: "#ApiSelect", label: "form.submittedByLabel", placeholder: "form.submittedByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "reviewedBy", widget: "#ApiSelect", label: "form.reviewedByLabel", placeholder: "form.reviewedByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
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

export const submittalCreateFormView: ViewConfig = {
    model: "submittals", viewType: "form", viewMode: "create", accessModel: "submittals",
    apiUrl: "/api/realEstate/submittal", method: "PUT", nodes: formNodes,
};

export const submittalEditFormView: ViewConfig = {
    model: "submittals", viewType: "form", viewMode: "edit", accessModel: "submittals",
    apiUrl: "/api/realEstate/submittal", method: "PATCH", nodes: formNodes,
};

export const submittalViews: ViewConfig[] = [submittalSheetView, submittalCreateFormView, submittalEditFormView];
