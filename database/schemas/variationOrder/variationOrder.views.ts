import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const variationOrderSheetView: ViewConfig = {
    model: "variationorders",
    viewType: "sheet",
    accessModel: "variationorders",
    apiUrl: "/api/realEstate/variationOrder",
    header: {titleField: "title", subtitleKey: "variationOrder", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "constructionContract"}, dependent: "constructionContract", field: {name: "constructionContract.name", widget: "#SmallInfoCard", label: "constructionContract", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "costImpact"}, dependent: "costImpact", field: {name: "costImpact", widget: "#SmallInfoCard", label: "costImpact", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "timeImpactDays"}, dependent: "timeImpactDays", field: {name: "timeImpactDays", widget: "#SmallInfoCard", label: "timeImpactDays", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "modificationRequest"}, dependent: "modificationRequest", field: {name: "modificationRequest.name", widget: "#SmallInfoCard", label: "modificationRequest", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "constructionContract", widget: "#ApiSelect", label: "form.constructionContractLabel", placeholder: "form.constructionContractPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructionContract/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", required: true, widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "costImpact", widget: "#Input", label: "form.costImpactLabel", placeholder: "form.costImpactPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "timeImpactDays", widget: "#Input", label: "form.timeImpactDaysLabel", placeholder: "form.timeImpactDaysPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "modificationRequest", widget: "#ApiSelect", label: "form.modificationRequestLabel", placeholder: "form.modificationRequestPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/unit/modificationRequest/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
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

export const variationOrderCreateFormView: ViewConfig = {
    model: "variationorders", viewType: "form", viewMode: "create", accessModel: "variationorders",
    apiUrl: "/api/realEstate/variationOrder", method: "PUT", nodes: formNodes,
};

export const variationOrderEditFormView: ViewConfig = {
    model: "variationorders", viewType: "form", viewMode: "edit", accessModel: "variationorders",
    apiUrl: "/api/realEstate/variationOrder", method: "PATCH", nodes: formNodes,
};

export const variationOrderViews: ViewConfig[] = [variationOrderSheetView, variationOrderCreateFormView, variationOrderEditFormView];
