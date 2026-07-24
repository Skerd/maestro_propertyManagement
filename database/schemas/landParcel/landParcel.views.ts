import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const landParcelSheetView: ViewConfig = {
    model: "landparcels",
    viewType: "sheet",
    accessModel: "landparcels",
    apiUrl: "/api/realEstate/landParcel",
    header: {titleField: "title", subtitleKey: "landParcel", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "cadastralReference"}, dependent: "cadastralReference", field: {name: "cadastralReference", widget: "#SmallInfoCard", label: "cadastralReference", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "areaSqm"}, dependent: "areaSqm", field: {name: "areaSqm", widget: "#SmallInfoCard", label: "areaSqm", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "zoning"}, dependent: "zoning", field: {name: "zoning", widget: "#SmallInfoCard", label: "zoning", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "acquisitionCost"}, dependent: "acquisitionCost", field: {name: "acquisitionCost", widget: "#SmallInfoCard", label: "acquisitionCost", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "dueDiligenceStatus"}, dependent: "dueDiligenceStatus", field: {name: "dueDiligenceStatus", widget: "#SmallInfoCard", label: "dueDiligenceStatus", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "cadastralReference", widget: "#Input", label: "form.cadastralReferenceLabel", placeholder: "form.cadastralReferencePlaceholder", }},
                    {render: "#Field", field: {name: "areaSqm", widget: "#Input", label: "form.areaSqmLabel", placeholder: "form.areaSqmPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "zoning", widget: "#Input", label: "form.zoningLabel", placeholder: "form.zoningPlaceholder", }},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "acquisitionCost", widget: "#Input", label: "form.acquisitionCostLabel", placeholder: "form.acquisitionCostPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "dueDiligenceStatus", widget: "#Input", label: "form.dueDiligenceStatusLabel", placeholder: "form.dueDiligenceStatusPlaceholder", }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
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

export const landParcelCreateFormView: ViewConfig = {
    model: "landparcels", viewType: "form", viewMode: "create", accessModel: "landparcels",
    apiUrl: "/api/realEstate/landParcel", method: "PUT", nodes: formNodes,
};

export const landParcelEditFormView: ViewConfig = {
    model: "landparcels", viewType: "form", viewMode: "edit", accessModel: "landparcels",
    apiUrl: "/api/realEstate/landParcel", method: "PATCH", nodes: formNodes,
};

export const landParcelViews: ViewConfig[] = [landParcelSheetView, landParcelCreateFormView, landParcelEditFormView];
