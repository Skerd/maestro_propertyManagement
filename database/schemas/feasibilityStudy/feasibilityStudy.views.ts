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
                        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "title"}, field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            dependent: "project",
                            field: {
                                name: "project.name",
                                widget: "#DisplayCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "landParcel"},
                            dependent: "landParcel",
                            field: {
                                name: "landParcel.name",
                                widget: "#DisplayCard",
                                label: "landParcel",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "landParcel",
                                    linkedSheetModel: "landparcels",
                                    linkedSheetWidget: "#LandParcelSheetView",
                                    linkedSheetEntityProp: "entity",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "currency"},
                            dependent: "currency",
                            field: {
                                name: "currency.name",
                                widget: "#DisplayCard",
                                label: "currency",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    valuePath: ["currency.symbol", "currency.name"],
                                    joinSeparator: " ",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "softCostEstimate"},
                            dependent: "softCostEstimate",
                            field: {
                                name: "softCostEstimate",
                                widget: "#DisplayCard",
                                label: "softCostEstimate",
                                widgetProps: {icon: "#Tag", format: "locale", valuePath: ["currency.symbol", "softCostEstimate"], joinSeparator: " ", type: "currency"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "hardCostEstimate"},
                            dependent: "hardCostEstimate",
                            field: {
                                name: "hardCostEstimate",
                                widget: "#DisplayCard",
                                label: "hardCostEstimate",
                                widgetProps: {icon: "#Tag", format: "locale", valuePath: ["currency.symbol", "hardCostEstimate"], joinSeparator: " ", type: "currency"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "residualValue"},
                            dependent: "residualValue",
                            field: {
                                name: "residualValue",
                                widget: "#DisplayCard",
                                label: "residualValue",
                                widgetProps: {icon: "#Tag", format: "locale", valuePath: ["currency.symbol", "residualValue"], joinSeparator: " ", type: "currency"},
                            },
                        },
                        {render: "#DisplayCard", permissions: {read: "irrPercent"}, dependent: "irrPercent", field: {name: "irrPercent", widget: "#DisplayCard", label: "irrPercent", widgetProps: {icon: "#Percent", suffix: "%"}}},
                        {render: "#DisplayCard", permissions: {read: "decision"}, dependent: "decision", field: {name: "decision", widget: "#DisplayCard", label: "decision", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "decidedBy"}, dependent: "decidedBy", field: {name: "decidedBy", widget: "#DisplayCard", label: "decidedBy", widgetProps: {icon: "#IconUserCheck", parent: "decidedBy", valuePath: ["name", "surname"], joinSeparator: " "}}},
                        {render: "#DisplayCard", permissions: {read: "decidedAt"}, dependent: "decidedAt", field: {name: "decidedAt", widget: "#DisplayCard", label: "decidedAt", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#DisplayCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statuses",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        draft: "secondary",
                                        in_review: "warning",
                                        approved: "success",
                                        rejected: "destructive",
                                        archived: "outline",
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "assumptions"},
            dependent: "assumptions",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "assumptions"}, field: {name: "assumptions", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "decisionNotes"},
            dependent: "decisionNotes",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "decisionNotes"}, field: {name: "decisionNotes", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "description"},
            dependent: "description",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "description"}, field: {name: "description", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "notes"},
            dependent: "notes",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "notes"}, field: {name: "notes", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
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

const feasibilityStudyCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"},
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            required: true,
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                cascadeClearFormFields: ["landParcel"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "landParcel",
                            widget: "#ApiSelect",
                            label: "form.landParcelLabel",
                            placeholder: "form.landParcelPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/landParcel/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "projectId"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "softCostEstimate", widget: "#Input", label: "form.softCostEstimateLabel", placeholder: "form.softCostEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "hardCostEstimate", widget: "#Input", label: "form.hardCostEstimateLabel", placeholder: "form.hardCostEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "residualValue", widget: "#Input", label: "form.residualValueLabel", placeholder: "form.residualValuePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "irrPercent", widget: "#Input", label: "form.irrPercentLabel", placeholder: "form.irrPercentPlaceholder", widgetProps: {type: "number"}}},
                ],
            },
            {render: "#Field", field: {name: "assumptions", widget: "#Textarea", label: "form.assumptionsLabel", placeholder: "form.assumptionsPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
            {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
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

const feasibilityStudyEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {
            readAny: ["project", "landParcel", "title", "assumptions", "currency", "softCostEstimate", "hardCostEstimate", "residualValue", "irrPercent", "description", "notes"],
            writeAny: ["project", "landParcel", "title", "assumptions", "currency", "softCostEstimate", "hardCostEstimate", "residualValue", "irrPercent", "description", "notes"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"},
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                cascadeClearFormFields: ["landParcel"],
                            },
                        },
                        permissions: {read: "project"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "landParcel",
                            widget: "#ApiSelect",
                            label: "form.landParcelLabel",
                            placeholder: "form.landParcelPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/landParcel/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "projectId"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "landParcel", write: "landParcel"},
                    },
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}, permissions: {read: "title", write: "title"}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}, permissions: {read: "currency", write: "currency"}},
                    {render: "#Field", field: {name: "softCostEstimate", widget: "#Input", label: "form.softCostEstimateLabel", placeholder: "form.softCostEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "softCostEstimate", write: "softCostEstimate"}},
                    {render: "#Field", field: {name: "hardCostEstimate", widget: "#Input", label: "form.hardCostEstimateLabel", placeholder: "form.hardCostEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "hardCostEstimate", write: "hardCostEstimate"}},
                    {render: "#Field", field: {name: "residualValue", widget: "#Input", label: "form.residualValueLabel", placeholder: "form.residualValuePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "residualValue", write: "residualValue"}},
                    {render: "#Field", field: {name: "irrPercent", widget: "#Input", label: "form.irrPercentLabel", placeholder: "form.irrPercentPlaceholder", widgetProps: {type: "number"}}, permissions: {read: "irrPercent", write: "irrPercent"}},
                ],
            },
            {render: "#Field", field: {name: "assumptions", widget: "#Textarea", label: "form.assumptionsLabel", placeholder: "form.assumptionsPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "assumptions", write: "assumptions"}},
            {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "description", write: "description"}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "notes", write: "notes"}},
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
                        permissions: {read: "media", write: "media"},
                    },
                ],
            },
        ],
    },
];

export const feasibilityStudyCreateFormView: ViewConfig = {
    model: "feasibilitystudies", viewType: "form", viewMode: "create", accessModel: "feasibilitystudies",
    apiUrl: "/api/realEstate/feasibilityStudy", method: "PUT", nodes: feasibilityStudyCreateFormNodes,
};

export const feasibilityStudyEditFormView: ViewConfig = {
    model: "feasibilitystudies", viewType: "form", viewMode: "edit", accessModel: "feasibilitystudies",
    apiUrl: "/api/realEstate/feasibilityStudy", method: "PATCH", nodes: feasibilityStudyEditFormNodes,
};

export const feasibilityStudyViews: ViewConfig[] = [feasibilityStudySheetView, feasibilityStudyCreateFormView, feasibilityStudyEditFormView];
