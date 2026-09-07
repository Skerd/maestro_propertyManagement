import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    LAND_PARCEL_LONG_TEXT_MAX,
    LAND_PARCEL_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/landParcel/landParcel.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
                        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "title"}, field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "project"},
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
                            permissions: {read: "edifice"},
                            field: {
                                name: "edifice.name",
                                widget: "#DisplayCard",
                                label: "edifice",
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "edifice",
                                    linkedSheetModel: "edifices",
                                    linkedSheetWidget: "#EdificeSheetView",
                                    linkedSheetEntityProp: "edifice",
                                },
                            },
                        },
                        {render: "#DisplayCard", permissions: {read: "cadastralReference"}, dependent: "cadastralReference", field: {name: "cadastralReference", widget: "#DisplayCard", label: "cadastralReference", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "areaSqm"}, field: {name: "areaSqm", widget: "#DisplayCard", label: "areaSqm", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "zoning"}, field: {name: "zoning", widget: "#DisplayCard", label: "zoning", widgetProps: {icon: "#IconLabel"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "currency"},
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
                            permissions: {read: "acquisitionCost"},
                            field: {
                                name: "acquisitionCost",
                                widget: "#DisplayCard",
                                label: "acquisitionCost",
                                widgetProps: {
                                    icon: "#Tag",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "acquisitionCost"],
                                    joinSeparator: " ",
                                    type: "currency",
                                },
                            },
                        },
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
                                        prospect: "secondary",
                                        under_dd: "warning",
                                        dd_failed: "destructive",
                                        acquired: "success",
                                        disposed: "outline",
                                    },
                                },
                            },
                        },
                    ],
                },
                {
                    render: "div",
                    dependent: "description",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "description"}, field: {name: "description", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            dependentAny: ["dueDiligenceStatus", "dueDiligenceNotes", "dueDiligenceSteps"],
            permissions: {readAny: ["dueDiligenceStatus", "dueDiligenceNotes", "dueDiligenceSteps"]},
            props: {
                title: "dueDiligence",
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "dueDiligenceStatus"}, dependent: "dueDiligenceStatus", field: {name: "dueDiligenceStatus", widget: "#DisplayCard", label: "dueDiligenceStatus", widgetProps: {icon: "#IconLabel"}}},
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "dueDiligenceNotes"},
                            dependent: "dueDiligenceNotes",
                            field: {
                                name: "dueDiligenceNotes",
                                widget: "#DisplayCard",
                                label: "dueDiligenceNotes",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#ReferencesViewModeScope",
                            dependent: "dueDiligenceSteps",
                            props: {
                                storageKey: "landParcel.sheet.dueDiligenceSteps.listDisplay",
                                defaultMode: "compact",
                            },
                            children: [
                                {
                                    render: "#DisplayCard",
                                    permissions: {read: "dueDiligenceSteps"},
                                    field: {
                                        name: "dueDiligenceSteps",
                                        widget: "#DisplayCard",
                                        label: "dueDiligenceSteps",
                                        widgetProps: {
                                            icon: "#History",
                                            bodyWidget: "#SheetEmbeddedItemsList",
                                            className: "p-0",
                                            titleActions: "#ReferencesViewModeToggle",
                                            pageSize: 3,
                                            sortField: "performedAt",
                                            sortDescending: true,
                                            compactSummaryFields: ["performedBy", "title", "performedAt"],
                                            fields: [
                                                {
                                                    name: "title",
                                                    type: "text",
                                                    className: "text-sm font-medium",
                                                },
                                                {
                                                    name: "performedBy",
                                                    type: "text",
                                                    valuePath: ["name", "surname"],
                                                    joinSeparator: " ",
                                                    className: "text-xs text-muted-foreground",
                                                },
                                                {
                                                    name: "performedAt",
                                                    type: "text",
                                                    format: "dateTime",
                                                    className: "text-xs text-muted-foreground",
                                                },
                                                {
                                                    name: "notes",
                                                    type: "expandableText",
                                                    className: "text-sm text-muted-foreground",
                                                },
                                                {
                                                    name: "media",
                                                    type: "mediaStrip",
                                                },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "acquisitionNotes"},
            dependent: "acquisitionNotes",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "acquisitionNotes"}, field: {name: "acquisitionNotes", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "disposeNotes"},
            dependent: "disposeNotes",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "disposeNotes"}, field: {name: "disposeNotes", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
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

const landParcelCreateFormNodes: ViewConfig["nodes"] = [
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
                        field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, cascadeClearFormFields: ["edifice"], normalizeEmptyToUndefined: true}},
                    },
                    {
                        render: "#Field",
                        field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, postBodyFromFormField: {field: "project", paramName: "project"}, remountKeyFormField: "project", normalizeEmptyToUndefined: true}},
                    },
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, widgetProps: {maxLength: LAND_PARCEL_SHORT_TEXT_MAX}}},
                    {render: "#Field", field: {name: "areaSqm", widget: "#Input", label: "form.areaSqmLabel", placeholder: "form.areaSqmPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "zoning", widget: "#Input", label: "form.zoningLabel", placeholder: "form.zoningPlaceholder", widgetProps: {maxLength: LAND_PARCEL_SHORT_TEXT_MAX}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "acquisitionCost", widget: "#Input", label: "form.acquisitionCostLabel", placeholder: "form.acquisitionCostPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                ],
            },
            {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: LAND_PARCEL_LONG_TEXT_MAX}}},
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
                        field: {name: "media", widget: "#FormMultiLocalFileField", widgetProps: {maxFiles: 20, accept: "application/pdf,image/*", existingListExtraKey: "editMediaExistingList", existingFilesLabelKey: "form.existingFiles", newFilesLabelKey: "form.newFiles"}},
                    },
                ],
            },
        ],
    },
];

const landParcelEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {readAny: ["project", "edifice", "title", "areaSqm", "zoning", "currency", "acquisitionCost", "description", "notes"], writeAny: ["project", "edifice", "title", "areaSqm", "zoning", "currency", "acquisitionCost", "description", "notes"]},
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
                                cascadeClearFormFields: ["edifice"],
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "project", write: "project"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "edifice", write: "edifice"},
                    },
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, widgetProps: {maxLength: LAND_PARCEL_SHORT_TEXT_MAX}}, permissions: {read: "title", write: "title"}},
                    {render: "#Field", field: {name: "areaSqm", widget: "#Input", label: "form.areaSqmLabel", placeholder: "form.areaSqmPlaceholder", widgetProps: {type: "number"}}, permissions: {read: "areaSqm", write: "areaSqm"}},
                    {render: "#Field", field: {name: "zoning", widget: "#Input", label: "form.zoningLabel", placeholder: "form.zoningPlaceholder", widgetProps: {maxLength: LAND_PARCEL_SHORT_TEXT_MAX}}, permissions: {read: "zoning", write: "zoning"}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}, permissions: {read: "currency", write: "currency"}},
                    {render: "#Field", field: {name: "acquisitionCost", widget: "#Input", label: "form.acquisitionCostLabel", placeholder: "form.acquisitionCostPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "acquisitionCost", write: "acquisitionCost"}},
                ],
            },
            {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: LAND_PARCEL_LONG_TEXT_MAX}}, permissions: {read: "description", write: "description"}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: LAND_PARCEL_LONG_TEXT_MAX}}, permissions: {read: "notes", write: "notes"}},
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

export const landParcelCreateFormView: ViewConfig = {
    model: "landparcels", viewType: "form", viewMode: "create", accessModel: "landparcels",
    apiUrl: "/api/realEstate/landParcel", method: "PUT", nodes: landParcelCreateFormNodes,
};

export const landParcelEditFormView: ViewConfig = {
    model: "landparcels", viewType: "form", viewMode: "edit", accessModel: "landparcels",
    apiUrl: "/api/realEstate/landParcel", method: "PATCH", nodes: landParcelEditFormNodes,
};

export const landParcelViews: ViewConfig[] = [landParcelSheetView, landParcelCreateFormView, landParcelEditFormView];
