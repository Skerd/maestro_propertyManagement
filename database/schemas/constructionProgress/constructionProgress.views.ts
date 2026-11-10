import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    CONSTRUCTION_PHASE_VALUES,
    CONSTRUCTION_PROGRESS_LONG_TEXT_MAX,
    CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.constants";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const phaseOptions = CONSTRUCTION_PHASE_VALUES.map((value) => ({value, label: `form.phase.${value}`}));

export const constructionProgressSheetView: ViewConfig = {
    model: "constructionprogresses",
    viewType: "sheet",
    accessModel: "constructionprogresses",
    apiUrl: "/api/realEstate/constructionProgress",
    header: {
        titleField: "title",
        subtitleKey: "constructionProgress",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            permissions: {
                readAny: ["name", "title", "project", "edifice", "phase", "progressPercent", "updateDate", "expectedCompletionDate", "description"],
            },
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "phase"},
                            field: {name: "phase", widget: "#DisplayCard", label: "phase", widgetProps: {icon: "#IconCrane", languageKeyCategory: "phaseEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "progressPercent"},
                            field: {name: "progressPercent", widget: "#DisplayCard", label: "progressPercent", widgetProps: {icon: "#Percent", suffix: "%"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "updateDate"},
                            field: {name: "updateDate", widget: "#DisplayCard", label: "updateDate", widgetProps: {icon: "#IconCalendarBolt", format: "date", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            field: {
                                name: "project",
                                widget: "#DisplayCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                    linkedSheetEntityProp: "project",
                                    parent: "project",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "edifice"},
                            field: {
                                name: "edifice",
                                widget: "#DisplayCard",
                                label: "edifice",
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "edifice",
                                    linkedSheetModel: "edifices",
                                    linkedSheetWidget: "#EdificeSheetView",
                                    linkedSheetEntityProp: "edifice",
                                    parent: "edifice",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "expectedCompletionDate"},
                            field: {name: "expectedCompletionDate", widget: "#DisplayCard", label: "expectedCompletionDate", widgetProps: {icon: "#IconCalendarCheck", format: "date", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "name"},
                            field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#Tag"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "title"},
                            field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}},
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "description"},
                            field: {name: "description", widget: "#DisplayCard", label: "description", widgetProps: {icon: "#IconAlignLeft", expandable: true, maxLength: 250}},
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            permissions: {readAny: ["notifyClients", "clientsNotifiedAt", "clientsNotifiedCount"]},
            props: {title: "clientNotifications"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "notifyClients"},
                            field: {name: "notifyClients", widget: "#DisplayCard", label: "notifyClients", widgetProps: {icon: "#Bell", languageKeyCategory: "activeState", variantLookupField: "notifyClients"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "clientsNotifiedAt"},
                            field: {name: "clientsNotifiedAt", widget: "#DisplayCard", label: "clientsNotifiedAt", widgetProps: {icon: "#Mail", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "clientsNotifiedCount"},
                            field: {name: "clientsNotifiedCount", widget: "#DisplayCard", label: "clientsNotifiedCount", widgetProps: {icon: "#Users"}},
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            permissions: {readAny: ["photos"]},
            props: {title: "photos"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "photos"},
                            field: {
                                name: "photos",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "photos",
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: true,
                                    showPreviews: true,
                                    previewLocation: "right",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const constructionProgressCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
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
                            widgetProps: {apiUrl: "/api/realEstate/project/select", pageSize: 50, cascadeClearFormFields: ["edifice"]},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "phase",
                            widget: "#SimpleSelect",
                            label: "form.phaseLabel",
                            placeholder: "form.phasePlaceholder",
                            required: true,
                            widgetProps: {options: phaseOptions, className: "grow w-full"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "progressPercent",
                            widget: "#Input",
                            label: "form.progressPercentLabel",
                            placeholder: "form.progressPercentPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "updateDate",
                            widget: "#DateInput",
                            label: "form.updateDateLabel",
                            placeholder: "form.updateDatePlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expectedCompletionDate",
                            widget: "#DateInput",
                            label: "form.expectedCompletionDateLabel",
                            placeholder: "form.expectedCompletionDatePlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: CONSTRUCTION_PROGRESS_LONG_TEXT_MAX,
                                    },
                                },
                            },
                        ],
                    },
                    // Automatic client notification only applies when the report is created; resends use the card action.
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full"},
                        children: [
                            {
                                render: "#Field",
                                field: {name: "notifyClients", widget: "#Switch", label: "form.notifyClientsLabel"},
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "div",
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.photosLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "photos",
                            widget: "#FormMultiLocalFileField",
                            widgetProps: {
                                maxFiles: 20,
                                accept: "image/*",
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

const constructionProgressEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {
            readAny: ["project", "edifice", "phase", "progressPercent", "updateDate", "expectedCompletionDate", "title", "description"],
            writeAny: ["project", "edifice", "phase", "progressPercent", "updateDate", "expectedCompletionDate", "title", "description"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            required: true,
                            widgetProps: {apiUrl: "/api/realEstate/project/select", pageSize: 50, cascadeClearFormFields: ["edifice"]},
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
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "edifice", write: "edifice"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "phase",
                            widget: "#SimpleSelect",
                            label: "form.phaseLabel",
                            placeholder: "form.phasePlaceholder",
                            required: true,
                            widgetProps: {options: phaseOptions, className: "grow w-full"},
                        },
                        permissions: {read: "phase", write: "phase"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "progressPercent",
                            widget: "#Input",
                            label: "form.progressPercentLabel",
                            placeholder: "form.progressPercentPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                        permissions: {read: "progressPercent", write: "progressPercent"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "updateDate",
                            widget: "#DateInput",
                            label: "form.updateDateLabel",
                            placeholder: "form.updateDatePlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                        permissions: {read: "updateDate", write: "updateDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expectedCompletionDate",
                            widget: "#DateInput",
                            label: "form.expectedCompletionDateLabel",
                            placeholder: "form.expectedCompletionDatePlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                        permissions: {read: "expectedCompletionDate", write: "expectedCompletionDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX},
                        },
                        permissions: {read: "title", write: "title"},
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: CONSTRUCTION_PROGRESS_LONG_TEXT_MAX,
                                    },
                                },
                                permissions: {read: "description", write: "description"},
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "div",
        permissions: {readAny: ["photos"], writeAny: ["photos"]},
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.photosLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "photos",
                            widget: "#FormMultiLocalFileField",
                            widgetProps: {
                                maxFiles: 20,
                                accept: "image/*",
                                existingListExtraKey: "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey: "form.newFiles",
                            },
                        },
                        permissions: {read: "photos", write: "photos"},
                    },
                ],
            },
        ],
    },
];

export const constructionProgressCreateFormView: ViewConfig = {
    model: "constructionprogresses",
    viewType: "form",
    viewMode: "create",
    accessModel: "constructionprogresses",
    apiUrl: "/api/realEstate/constructionProgress",
    method: "PUT",
    nodes: constructionProgressCreateFormNodes,
};

export const constructionProgressEditFormView: ViewConfig = {
    model: "constructionprogresses",
    viewType: "form",
    viewMode: "edit",
    accessModel: "constructionprogresses",
    apiUrl: "/api/realEstate/constructionProgress",
    method: "PATCH",
    nodes: constructionProgressEditFormNodes,
};

export const constructionProgressViews: ViewConfig[] = [
    constructionProgressSheetView,
    constructionProgressCreateFormView,
    constructionProgressEditFormView,
];
