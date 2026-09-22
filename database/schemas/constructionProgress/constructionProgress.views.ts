import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    CONSTRUCTION_PHASE_VALUES,
    CONSTRUCTION_PROGRESS_LONG_TEXT_MAX,
    CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionProgress/constructionProgress.constants";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

type ViewNode = ViewConfig["nodes"][number];

const phaseOptions = CONSTRUCTION_PHASE_VALUES.map((value) => ({value, label: `form.phase.${value}`}));

function card(name: string, widgetProps: Record<string, unknown>): ViewNode {
    return {
        render: "#DisplayCard",
        permissions: {read: name},
        field: {name, widget: "#DisplayCard", label: name, widgetProps},
    };
}

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
                        card("phase", {icon: "#IconCrane", languageKeyCategory: "phaseEnum", type: "enum"}),
                        card("progressPercent", {icon: "#Percent", suffix: "%"}),
                        card("updateDate", {icon: "#IconCalendarBolt", format: "date", type: "date"}),
                        card("project", {
                            icon: "#IconFolder",
                            linkedRefPath: "project",
                            linkedSheetModel: "projects",
                            linkedSheetWidget: "#ProjectSheetView",
                            linkedSheetEntityProp: "project",
                            parent: "project",
                            valuePath: ["name", "_id"],
                            pickFirstTruthyValuePath: true,
                        }),
                        card("edifice", {
                            icon: "#Building",
                            linkedRefPath: "edifice",
                            linkedSheetModel: "edifices",
                            linkedSheetWidget: "#EdificeSheetView",
                            linkedSheetEntityProp: "edifice",
                            parent: "edifice",
                            valuePath: ["name", "_id"],
                            pickFirstTruthyValuePath: true,
                        }),
                        card("expectedCompletionDate", {icon: "#IconCalendarCheck", format: "date", type: "date"}),
                        card("name", {icon: "#Tag"}),
                        card("title", {icon: "#IconLabel"}),
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [card("description", {icon: "#IconAlignLeft", expandable: true, maxLength: 250})],
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
                        card("notifyClients", {icon: "#Bell", languageKeyCategory: "activeState", variantLookupField: "notifyClients"}),
                        card("clientsNotifiedAt", {icon: "#Mail", format: "datetime", type: "date"}),
                        card("clientsNotifiedCount", {icon: "#Users"}),
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

/** Edit forms gate each field by its own read/write permission; create forms do not. */
function field(node: ViewNode, name: string, edit: boolean): ViewNode {
    return edit ? {...node, permissions: {read: name, write: name}} : node;
}

function formNodes(edit: boolean): ViewConfig["nodes"] {
    const general: ViewNode[] = [
        field({
            render: "#Field",
            ...(edit ? {} : {props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"}}),
            field: {
                name: "project",
                widget: "#ApiSelect",
                label: "form.projectLabel",
                placeholder: "form.projectPlaceholder",
                required: true,
                widgetProps: {apiUrl: "/api/realEstate/project/select", pageSize: 50, cascadeClearFormFields: ["edifice"]},
            },
        }, "project", edit),
        field({
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
        }, "edifice", edit),
        field({
            render: "#Field",
            field: {
                name: "phase",
                widget: "#SimpleSelect",
                label: "form.phaseLabel",
                placeholder: "form.phasePlaceholder",
                required: true,
                widgetProps: {options: phaseOptions, className: "grow w-full"},
            },
        }, "phase", edit),
        field({
            render: "#Field",
            field: {
                name: "progressPercent",
                widget: "#Input",
                label: "form.progressPercentLabel",
                placeholder: "form.progressPercentPlaceholder",
                required: true,
                widgetProps: {type: "number", min: 0, max: 100},
            },
        }, "progressPercent", edit),
        field({
            render: "#Field",
            field: {
                name: "updateDate",
                widget: "#DateInput",
                label: "form.updateDateLabel",
                placeholder: "form.updateDatePlaceholder",
                required: true,
                widgetProps: {valueFormat: "yyyy-MM-dd"},
            },
        }, "updateDate", edit),
        field({
            render: "#Field",
            field: {
                name: "expectedCompletionDate",
                widget: "#DateInput",
                label: "form.expectedCompletionDateLabel",
                placeholder: "form.expectedCompletionDatePlaceholder",
                widgetProps: {valueFormat: "yyyy-MM-dd"},
            },
        }, "expectedCompletionDate", edit),
        field({
            render: "#Field",
            field: {
                name: "title",
                widget: "#Input",
                label: "form.titleLabel",
                placeholder: "form.titlePlaceholder",
                required: true,
                widgetProps: {maxLength: CONSTRUCTION_PROGRESS_SHORT_TEXT_MAX},
            },
        }, "title", edit),
        {
            render: "div",
            props: {className: "md:col-span-2 w-full space-y-1.5"},
            children: [
                field({
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
                }, "description", edit),
            ],
        },
    ];

    // Automatic client notification only applies when the report is created; resends use the card action.
    if (!edit) {
        general.push({
            render: "div",
            props: {className: "md:col-span-2 w-full"},
            children: [
                {
                    render: "#Field",
                    field: {name: "notifyClients", widget: "#Switch", label: "form.notifyClientsLabel"},
                },
            ],
        });
    }

    return [
        {
            render: "#TitleWithCollapse",
            props: {title: "generalInfo"},
            ...(edit
                ? {permissions: {readAny: ["project", "edifice", "phase", "progressPercent", "updateDate", "expectedCompletionDate", "title", "description"]}}
                : {}),
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 2, className: "gap-x-4 gap-y-5"},
                    children: general,
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
                        field({
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
                        }, "photos", edit),
                    ],
                },
            ],
        },
    ];
}

export const constructionProgressCreateFormView: ViewConfig = {
    model: "constructionprogresses",
    viewType: "form",
    viewMode: "create",
    accessModel: "constructionprogresses",
    apiUrl: "/api/realEstate/constructionProgress",
    method: "PUT",
    nodes: formNodes(false),
};

export const constructionProgressEditFormView: ViewConfig = {
    model: "constructionprogresses",
    viewType: "form",
    viewMode: "edit",
    accessModel: "constructionprogresses",
    apiUrl: "/api/realEstate/constructionProgress",
    method: "PATCH",
    nodes: formNodes(true),
};

export const constructionProgressViews: ViewConfig[] = [
    constructionProgressSheetView,
    constructionProgressCreateFormView,
    constructionProgressEditFormView,
];
