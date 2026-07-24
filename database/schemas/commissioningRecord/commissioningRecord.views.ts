import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const commissioningRecordSheetView: ViewConfig = {
    model: "commissioningrecords",
    viewType: "sheet",
    accessModel: "commissioningrecords",
    apiUrl: "/api/realEstate/commissioningRecord",
    header: {titleField: "title", subtitleKey: "commissioningRecord", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "unit"}, dependent: "unit", field: {name: "unit.name", widget: "#SmallInfoCard", label: "unit", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "handoverPackage"}, dependent: "handoverPackage", field: {name: "handoverPackage.name", widget: "#SmallInfoCard", label: "handoverPackage", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "systemName"}, dependent: "systemName", field: {name: "systemName", widget: "#SmallInfoCard", label: "systemName", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "testDate"}, dependent: "testDate", field: {name: "testDate", widget: "#SmallInfoCard", label: "testDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "resultNotes"}, dependent: "resultNotes", field: {name: "resultNotes", widget: "#SmallInfoCard", label: "resultNotes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "inspectedBy"}, dependent: "inspectedBy", field: {name: "inspectedBy", widget: "#SmallInfoCard", label: "inspectedBy", widgetProps: {icon: "#IconUserCheck", parent: "inspectedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
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
                    {render: "#Field", field: {name: "unit", widget: "#ApiSelect", label: "form.unitLabel", placeholder: "form.unitPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/unit/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "handoverPackage", widget: "#ApiSelect", label: "form.handoverPackageLabel", placeholder: "form.handoverPackagePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/handoverPackage/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "systemName", widget: "#Input", label: "form.systemNameLabel", placeholder: "form.systemNamePlaceholder", }},
                    {render: "#Field", field: {name: "testDate", widget: "#DateInput", label: "form.testDateLabel", placeholder: "form.testDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "resultNotes", widget: "#Textarea", label: "form.resultNotesLabel", placeholder: "form.resultNotesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "inspectedBy", widget: "#ApiSelect", label: "form.inspectedByLabel", placeholder: "form.inspectedByPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/company/users/select", method: "POST", postBody: {administration: true}, normalizeEmptyToUndefined: true}}},
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

export const commissioningRecordCreateFormView: ViewConfig = {
    model: "commissioningrecords", viewType: "form", viewMode: "create", accessModel: "commissioningrecords",
    apiUrl: "/api/realEstate/commissioningRecord", method: "PUT", nodes: formNodes,
};

export const commissioningRecordEditFormView: ViewConfig = {
    model: "commissioningrecords", viewType: "form", viewMode: "edit", accessModel: "commissioningrecords",
    apiUrl: "/api/realEstate/commissioningRecord", method: "PATCH", nodes: formNodes,
};

export const commissioningRecordViews: ViewConfig[] = [commissioningRecordSheetView, commissioningRecordCreateFormView, commissioningRecordEditFormView];
