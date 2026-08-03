import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const constructionContractSheetView: ViewConfig = {
    model: "constructioncontracts",
    viewType: "sheet",
    accessModel: "constructioncontracts",
    apiUrl: "/api/realEstate/constructionContract",
    header: {titleField: "title", subtitleKey: "constructionContract", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "workPackage"}, dependent: "workPackage", field: {name: "workPackage.name", widget: "#SmallInfoCard", label: "workPackage", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#SmallInfoCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "contractValue"}, dependent: "contractValue", field: {name: "contractValue", widget: "#SmallInfoCard", label: "contractValue", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "retentionPercent"}, dependent: "retentionPercent", field: {name: "retentionPercent", widget: "#SmallInfoCard", label: "retentionPercent", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "performanceBond"}, dependent: "performanceBond", field: {name: "performanceBond", widget: "#SmallInfoCard", label: "performanceBond", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "paymentTerms"}, dependent: "paymentTerms", field: {name: "paymentTerms", widget: "#SmallInfoCard", label: "paymentTerms", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "startDate"}, dependent: "startDate", field: {name: "startDate", widget: "#SmallInfoCard", label: "startDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "endDate"}, dependent: "endDate", field: {name: "endDate", widget: "#SmallInfoCard", label: "endDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "approvedVariationsTotal"}, dependent: "approvedVariationsTotal", field: {name: "approvedVariationsTotal", widget: "#SmallInfoCard", label: "approvedVariationsTotal", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "certifiedClaimsTotal"}, dependent: "certifiedClaimsTotal", field: {name: "certifiedClaimsTotal", widget: "#SmallInfoCard", label: "certifiedClaimsTotal", widgetProps: {icon: "#IconLabel"}}},
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
                    {render: "#Field", field: {name: "workPackage", widget: "#ApiSelect", label: "form.workPackageLabel", placeholder: "form.workPackagePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/workPackage/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "contractValue", widget: "#Input", label: "form.contractValueLabel", placeholder: "form.contractValuePlaceholder", required: true, widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "retentionPercent", widget: "#Input", label: "form.retentionPercentLabel", placeholder: "form.retentionPercentPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "performanceBond", widget: "#Input", label: "form.performanceBondLabel", placeholder: "form.performanceBondPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "paymentTerms", widget: "#Textarea", label: "form.paymentTermsLabel", placeholder: "form.paymentTermsPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "startDate", widget: "#DateInput", label: "form.startDateLabel", placeholder: "form.startDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "endDate", widget: "#DateInput", label: "form.endDateLabel", placeholder: "form.endDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
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

export const constructionContractCreateFormView: ViewConfig = {
    model: "constructioncontracts", viewType: "form", viewMode: "create", accessModel: "constructioncontracts",
    apiUrl: "/api/realEstate/constructionContract", method: "PUT", nodes: formNodes,
};

export const constructionContractEditFormView: ViewConfig = {
    model: "constructioncontracts", viewType: "form", viewMode: "edit", accessModel: "constructioncontracts",
    apiUrl: "/api/realEstate/constructionContract", method: "PATCH", nodes: formNodes,
};

export const constructionContractViews: ViewConfig[] = [constructionContractSheetView, constructionContractCreateFormView, constructionContractEditFormView];
