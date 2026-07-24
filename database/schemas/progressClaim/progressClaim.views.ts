import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const progressClaimSheetView: ViewConfig = {
    model: "progressclaims",
    viewType: "sheet",
    accessModel: "progressclaims",
    apiUrl: "/api/realEstate/progressClaim",
    header: {titleField: "title", subtitleKey: "progressClaim", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "constructionContract"}, dependent: "constructionContract", field: {name: "constructionContract.name", widget: "#SmallInfoCard", label: "constructionContract", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "claimPeriodStart"}, dependent: "claimPeriodStart", field: {name: "claimPeriodStart", widget: "#SmallInfoCard", label: "claimPeriodStart", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "claimPeriodEnd"}, dependent: "claimPeriodEnd", field: {name: "claimPeriodEnd", widget: "#SmallInfoCard", label: "claimPeriodEnd", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "amount"}, dependent: "amount", field: {name: "amount", widget: "#SmallInfoCard", label: "amount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "certifiedAmount"}, dependent: "certifiedAmount", field: {name: "certifiedAmount", widget: "#SmallInfoCard", label: "certifiedAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "retentionHeld"}, dependent: "retentionHeld", field: {name: "retentionHeld", widget: "#SmallInfoCard", label: "retentionHeld", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "retentionReleased"}, dependent: "retentionReleased", field: {name: "retentionReleased", widget: "#SmallInfoCard", label: "retentionReleased", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructionContract", widget: "#ApiSelect", label: "form.constructionContractLabel", placeholder: "form.constructionContractPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructionContract/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "claimPeriodStart", widget: "#DateInput", label: "form.claimPeriodStartLabel", placeholder: "form.claimPeriodStartPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "claimPeriodEnd", widget: "#DateInput", label: "form.claimPeriodEndLabel", placeholder: "form.claimPeriodEndPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "amount", widget: "#Input", label: "form.amountLabel", placeholder: "form.amountPlaceholder", required: true, widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "certifiedAmount", widget: "#Input", label: "form.certifiedAmountLabel", placeholder: "form.certifiedAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "retentionHeld", widget: "#Input", label: "form.retentionHeldLabel", placeholder: "form.retentionHeldPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "retentionReleased", widget: "#Input", label: "form.retentionReleasedLabel", placeholder: "form.retentionReleasedPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
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

export const progressClaimCreateFormView: ViewConfig = {
    model: "progressclaims", viewType: "form", viewMode: "create", accessModel: "progressclaims",
    apiUrl: "/api/realEstate/progressClaim", method: "PUT", nodes: formNodes,
};

export const progressClaimEditFormView: ViewConfig = {
    model: "progressclaims", viewType: "form", viewMode: "edit", accessModel: "progressclaims",
    apiUrl: "/api/realEstate/progressClaim", method: "PATCH", nodes: formNodes,
};

export const progressClaimViews: ViewConfig[] = [progressClaimSheetView, progressClaimCreateFormView, progressClaimEditFormView];
